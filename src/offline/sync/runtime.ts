import { fetchAssignment } from '../../api/assignments';
import { refreshCourse, refreshLesson } from '../../api/courses';
import { getServerCapabilities } from '../../api/discovery';
import { getSessionUserId } from '../../api/session';
import { fetchChanges } from '../../api/sync';
import { getDb } from '../db';
import { cacheDelete } from '../localCache';
import { reconcileLessonResources, removeCourseDownloads, removeLessonAll } from '../mediaDownloads';
import { planSync, type LocalIndex, type SyncPage } from './plan';

/**
 * Sincronización incremental (0.4.0). Al abrir la app y al recuperar conexión:
 * pide `/sync/changes` desde el último cursor, trae solo lo que cambió (texto
 * de la lección, consignas y lista de recursos; nunca archivos ni video) y
 * borra lo eliminado o lo de matrículas terminadas. El cursor solo avanza si
 * todo se aplicó: un corte a mitad repite la próxima vez.
 */

const MAX_PAGES = 50;
const FETCH_CONCURRENCY = 3;

export type SyncResult = { fetched: number; removed: number };

const listeners = new Set<() => void>();
let running: Promise<SyncResult | null> | null = null;

/** Avisa a las pantallas cuando terminó una sincronización con cambios. */
export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function loadState(userId: number): Promise<{ cursor: string; index: LocalIndex }> {
  const db = await getDb();
  const state = await db.getFirstAsync<{ cursor: string }>('SELECT cursor FROM sync_state WHERE user_id = ?', userId);
  const rows = await db.getAllAsync<{ kind: string; entity_id: number; course_id: number; revision: number }>(
    'SELECT kind, entity_id, course_id, revision FROM sync_index WHERE user_id = ?',
    userId,
  );
  const index: LocalIndex = { courses: {}, lessons: {} };
  for (const row of rows) {
    if (row.kind === 'course') index.courses[row.entity_id] = row.revision;
    else index.lessons[row.entity_id] = { courseId: row.course_id, revision: row.revision };
  }
  return { cursor: state?.cursor ?? '', index };
}

async function saveState(userId: number, cursor: string, index: LocalIndex): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sync_index WHERE user_id = ?', userId);
    for (const [id, revision] of Object.entries(index.courses)) {
      await db.runAsync('INSERT INTO sync_index (user_id, kind, entity_id, course_id, revision) VALUES (?, ?, ?, ?, ?)', userId, 'course', Number(id), Number(id), revision);
    }
    for (const [id, lesson] of Object.entries(index.lessons)) {
      await db.runAsync('INSERT INTO sync_index (user_id, kind, entity_id, course_id, revision) VALUES (?, ?, ?, ?, ?)', userId, 'lesson', Number(id), lesson.courseId, lesson.revision);
    }
    await db.runAsync('INSERT OR REPLACE INTO sync_state (user_id, cursor, synced_at) VALUES (?, ?, ?)', userId, cursor, Date.now());
  });
}

async function inBatches<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += FETCH_CONCURRENCY) {
    await Promise.all(items.slice(i, i + FETCH_CONCURRENCY).map(task));
  }
}

async function sync(token: string): Promise<SyncResult | null> {
  const caps = await getServerCapabilities();
  if (!caps.sync_changes) return null; // Servidor anterior a 6.28.0.
  const userId = await getSessionUserId();
  if (!userId) return null;

  const { cursor, index } = await loadState(userId);
  const pages: SyncPage[] = [];
  let next = cursor;
  for (let i = 0; i < MAX_PAGES; i += 1) {
    const page = await fetchChanges(next, token);
    pages.push(page);
    next = page.next_cursor;
    if (!page.has_more) break;
  }

  const plan = planSync(index, pages);

  // 1) Bajas: contenido y descargas locales.
  for (const lessonId of plan.removeLessons) {
    await cacheDelete(userId, 'lesson', lessonId);
    await cacheDelete(userId, 'assignment', lessonId);
    await removeLessonAll(lessonId);
  }
  for (const courseId of plan.removeCourses) {
    await cacheDelete(userId, 'course', courseId);
    await removeCourseDownloads(courseId);
  }

  // 2) Cursos: detalle y currículo. Un curso nuevo trae todas sus lecciones.
  // Una lección nueva, cambiada o quitada deja viejo el currículo de su curso.
  const coursesToFetch = new Set(plan.fetchCourses);
  for (const lessonId of [...plan.fetchLessons, ...plan.removeLessons]) {
    const courseId = plan.index.lessons[lessonId]?.courseId ?? index.lessons[lessonId]?.courseId;
    if (courseId && plan.index.courses[courseId] !== undefined) coursesToFetch.add(courseId);
  }
  const lessonsToFetch = new Set(plan.fetchLessons);
  await inBatches([...coursesToFetch], async (courseId) => {
    const detail = await refreshCourse(courseId, token);
    plan.index.courses[courseId] = detail.course.revision ?? plan.index.courses[courseId] ?? 0;
    if (plan.newCourses.includes(courseId)) {
      for (const lesson of detail.curriculum) {
        if (!plan.index.lessons[lesson.id]) {
          plan.index.lessons[lesson.id] = { courseId, revision: 0 };
          lessonsToFetch.add(lesson.id);
        }
      }
    }
  });

  // 3) Lecciones: solo lo liviano (texto, consignas, lista de recursos).
  await inBatches([...lessonsToFetch], async (lessonId) => {
    const lesson = await refreshLesson(lessonId, token);
    const known = plan.index.lessons[lessonId];
    plan.index.lessons[lessonId] = { courseId: lesson.course_id || known?.courseId || 0, revision: lesson.revision ?? known?.revision ?? 0 };
    if (lesson.assignment_available && caps.assignments) {
      await fetchAssignment(lessonId, token).catch(() => undefined);
    }
    await reconcileLessonResources(lesson).catch(() => undefined);
  });

  await saveState(userId, next, plan.index);
  const result = { fetched: coursesToFetch.size + lessonsToFetch.size, removed: plan.removeCourses.length + plan.removeLessons.length };
  if (result.fetched || result.removed) {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Una pantalla desmontada no debe romper la sincronización.
      }
    });
  }
  return result;
}

/** Una sola ejecución a la vez; las llamadas concurrentes esperan la misma. */
export function runSync(token: string): Promise<SyncResult | null> {
  if (running) return running;
  running = sync(token).finally(() => {
    running = null;
  });
  return running;
}
