import { refreshAssignment } from '../../api/assignments';
import { refreshCourse, refreshLesson } from '../../api/courses';
import { getServerCapabilities } from '../../api/discovery';
import { getSessionUserId } from '../../api/session';
import { fetchChanges } from '../../api/sync';
import { getDb } from '../db';
import { cacheDelete } from '../localCache';
import { reconcileLessonResources, removeCourseDownloads, removeLessonAll } from '../mediaDownloads';
import { applyPlan, type PendingItem } from './apply';
import { planSync, type FullCarry, type LocalIndex, type SyncPage } from './plan';

/**
 * Sincronización incremental (0.4.0). Al abrir la app y al recuperar conexión:
 * pide `/sync/changes` desde el último cursor, trae solo lo que cambió (texto
 * de la lección, consignas y lista de recursos; nunca archivos ni video) y
 * borra lo eliminado o lo de matrículas terminadas.
 *
 * 0.4.1: un objeto que falla conserva su revisión anterior (apply.ts) y se
 * vuelve a pedir la próxima vez; si falla todo, no se guarda nada. Si el límite
 * de páginas corta un estado completo, se guarda el cursor de continuación del
 * servidor junto con lo ya visto (`full_seen`) y la poda espera a la última página.
 *
 * 0.5.3: lo que falla va a `sync_pending` en la misma transacción que guarda el
 * cursor, y cada sincronización lo reintenta primero aunque la respuesta venga vacía.
 */

const MAX_PAGES = 50;

export type SyncResult = { fetched: number; removed: number; failed: number };

const listeners = new Set<() => void>();
let running: Promise<SyncResult | null> | null = null;

/** Avisa a las pantallas cuando terminó una sincronización con cambios. */
export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function loadPending(userId: number): Promise<PendingItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ kind: string; entity_id: number; course_id: number; target_revision: number; attempts: number; last_error: string; next_attempt_at: number; new_course: number }>(
    'SELECT kind, entity_id, course_id, target_revision, attempts, last_error, next_attempt_at, new_course FROM sync_pending WHERE user_id = ?',
    userId,
  );
  return rows.map((row) => ({
    kind: row.kind === 'course' ? 'course' : 'lesson',
    id: row.entity_id,
    courseId: row.course_id,
    targetRevision: row.target_revision,
    attempts: row.attempts,
    lastError: row.last_error,
    nextAttemptAt: row.next_attempt_at,
    newCourse: row.new_course === 1,
  }));
}

async function loadState(userId: number): Promise<{ cursor: string; index: LocalIndex; carry: FullCarry | null }> {
  const db = await getDb();
  const state = await db.getFirstAsync<{ cursor: string; full_seen: string }>('SELECT cursor, full_seen FROM sync_state WHERE user_id = ?', userId);
  const rows = await db.getAllAsync<{ kind: string; entity_id: number; course_id: number; revision: number }>(
    'SELECT kind, entity_id, course_id, revision FROM sync_index WHERE user_id = ?',
    userId,
  );
  const index: LocalIndex = { courses: {}, lessons: {} };
  for (const row of rows) {
    if (row.kind === 'course') index.courses[row.entity_id] = row.revision;
    else index.lessons[row.entity_id] = { courseId: row.course_id, revision: row.revision };
  }
  let carry: FullCarry | null = null;
  try {
    carry = state?.full_seen ? (JSON.parse(state.full_seen) as FullCarry) : null;
  } catch {
    carry = null;
  }
  return { cursor: state?.cursor ?? '', index, carry };
}

async function saveState(userId: number, cursor: string, index: LocalIndex, carry: FullCarry | null, pending: PendingItem[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Pendientes y cursor juntos: si el cursor avanza, lo que falló queda registrado.
    await db.runAsync('DELETE FROM sync_pending WHERE user_id = ?', userId);
    for (const item of pending) {
      await db.runAsync(
        'INSERT INTO sync_pending (user_id, kind, entity_id, course_id, target_revision, attempts, last_error, next_attempt_at, new_course) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        userId, item.kind, item.id, item.courseId, item.targetRevision, item.attempts, item.lastError, item.nextAttemptAt, item.newCourse ? 1 : 0,
      );
    }
    await db.runAsync('DELETE FROM sync_index WHERE user_id = ?', userId);
    for (const [id, revision] of Object.entries(index.courses)) {
      await db.runAsync('INSERT INTO sync_index (user_id, kind, entity_id, course_id, revision) VALUES (?, ?, ?, ?, ?)', userId, 'course', Number(id), Number(id), revision);
    }
    for (const [id, lesson] of Object.entries(index.lessons)) {
      await db.runAsync('INSERT INTO sync_index (user_id, kind, entity_id, course_id, revision) VALUES (?, ?, ?, ?, ?)', userId, 'lesson', Number(id), lesson.courseId, lesson.revision);
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_state (user_id, cursor, synced_at, full_seen) VALUES (?, ?, ?, ?)',
      userId, cursor, Date.now(), carry ? JSON.stringify(carry) : '',
    );
  });
}

async function sync(token: string): Promise<SyncResult | null> {
  const caps = await getServerCapabilities();
  if (!caps.sync_changes) return null; // Servidor anterior a 6.28.0.
  const userId = await getSessionUserId();
  if (!userId) return null;

  const { cursor, index, carry } = await loadState(userId);
  const pendingBefore = await loadPending(userId);
  const pages: SyncPage[] = [];
  let next = cursor;
  for (let i = 0; i < MAX_PAGES; i += 1) {
    const page = await fetchChanges(next, token);
    pages.push(page);
    next = page.next_cursor;
    if (!page.has_more) break;
  }

  // Lo visto se guarda solo si un estado completo quedó cortado, y entonces el
  // cursor guardado es la continuación del servidor. Un reset empieza de nuevo.
  const plan = planSync(index, pages, pages[0]?.reset ? null : carry);

  const result = await applyPlan(plan, index, {
    removeLesson: async (lessonId) => {
      await cacheDelete(userId, 'lesson', lessonId);
      await cacheDelete(userId, 'assignment', lessonId);
      await removeLessonAll(lessonId);
    },
    removeCourse: async (courseId) => {
      await cacheDelete(userId, 'course', courseId);
      await removeCourseDownloads(courseId);
    },
    syncCourse: async (courseId) => {
      const detail = await refreshCourse(courseId, token);
      return { revision: detail.course.revision, lessonIds: detail.curriculum.map((lesson) => lesson.id) };
    },
    syncLesson: async (lessonId) => {
      // Cualquier paso que falle deja la lección pendiente (sin .catch silenciosos).
      const lesson = await refreshLesson(lessonId, token);
      if (lesson.assignment_available && caps.assignments) await refreshAssignment(lessonId, token);
      await reconcileLessonResources(lesson);
      return { courseId: lesson.course_id, revision: lesson.revision };
    },
  }, pendingBefore, Date.now());

  await saveState(userId, next, result.index, plan.fullCarry, result.pending);
  if (result.fetched || result.removed) {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Una pantalla desmontada no debe romper la sincronización.
      }
    });
  }
  return { fetched: result.fetched, removed: result.removed, failed: result.failed };
}

/** Una sola ejecución a la vez; las llamadas concurrentes esperan la misma. */
export function runSync(token: string): Promise<SyncResult | null> {
  if (running) return running;
  running = sync(token).finally(() => {
    running = null;
  });
  return running;
}
