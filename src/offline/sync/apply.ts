/**
 * Aplicar un plan de sincronización (0.4.1). Módulo puro: las operaciones de
 * red y almacenamiento se inyectan, para probarlo con Jest.
 *
 * Si falla cualquier paso de una lección (detalle, consigna, recursos) o de un
 * curso, ese objeto **no** guarda su revisión nueva: conserva la anterior (o 0
 * si era nuevo). Si fallan todos los pedidos que trajo el servidor, se lanza
 * el error y no se guarda nada.
 *
 * 0.5.3: lo que falla queda en `pending` (tabla `sync_pending`) con su revisión
 * objetivo. Cada sincronización lo reintenta primero, aunque la respuesta del
 * servidor venga vacía (el cursor ya avanzó y el servidor no lo vuelve a
 * listar). Espera creciente por elemento; tras 10 intentos sigue pendiente,
 * pero ya no cuenta como fallo de la sincronización. Un 404/403 en el
 * reintento se trata como baja.
 */
import type { LocalIndex, SyncPlan } from './plan';
import { t } from '../../i18n/core';

export type ApplyDeps = {
  removeLesson(lessonId: number): Promise<void>;
  removeCourse(courseId: number): Promise<void>;
  /** Detalle y currículo; lanza si falla. */
  syncCourse(courseId: number): Promise<{ revision?: number; lessonIds: number[] }>;
  /** Detalle, consigna y recursos; lanza si falla cualquiera. */
  syncLesson(lessonId: number): Promise<{ courseId: number; revision?: number }>;
};

/** Un curso o lección cuya sincronización falló (fila de `sync_pending`). */
export type PendingItem = {
  kind: 'course' | 'lesson';
  id: number;
  courseId: number;
  /** Revisión que el servidor anunció y la app aún no tiene. */
  targetRevision: number;
  attempts: number;
  lastError: string;
  nextAttemptAt: number;
  /** Curso nuevo para la app: al lograrlo, se piden también todas sus lecciones. */
  newCourse: boolean;
};

export type ApplyResult = { index: LocalIndex; fetched: number; removed: number; failed: number; pending: PendingItem[] };

export class SyncAllFailedError extends Error {
  constructor(readonly cause: unknown) {
    super(t('No se pudo traer ningún cambio.'));
  }
}

const CONCURRENCY = 3;
/** Desde este intento, un pendiente sigue reintentándose pero ya no cuenta como fallo. */
export const MAX_BLOCKING_ATTEMPTS = 10;
const BASE_DELAY_MS = 60_000;
const MAX_DELAY_MS = 6 * 60 * 60_000;

/** Espera antes del siguiente intento: 1, 2, 4, 8… minutos, hasta 6 horas. */
export function retryDelayMs(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

const key = (kind: PendingItem['kind'], id: number) => `${kind}:${id}`;

function errorStatus(reason: unknown): number {
  const status = (reason as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : 0;
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason ?? '');
}

async function inBatches<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(task));
  }
}

export async function applyPlan(
  plan: SyncPlan,
  previous: LocalIndex,
  deps: ApplyDeps,
  pendingBefore: PendingItem[] = [],
  now: number = Date.now(),
): Promise<ApplyResult> {
  const index: LocalIndex = { courses: { ...plan.index.courses }, lessons: { ...plan.index.lessons } };
  const pending = new Map<string, PendingItem>(pendingBefore.map((item) => [key(item.kind, item.id), { ...item }]));
  let removed = plan.removeCourses.length + plan.removeLessons.length;

  // 1) Bajas: contenido y descargas locales. Lo dado de baja ya no está pendiente.
  for (const lessonId of plan.removeLessons) {
    await deps.removeLesson(lessonId);
    pending.delete(key('lesson', lessonId));
  }
  for (const courseId of plan.removeCourses) {
    await deps.removeCourse(courseId);
    pending.delete(key('course', courseId));
  }

  // Si el servidor vuelve a anunciar un pendiente, su revisión objetivo pasa a ser la nueva (sin duplicar).
  for (const item of pending.values()) {
    if (item.kind === 'course' && plan.fetchCourses.includes(item.id)) item.targetRevision = index.courses[item.id] ?? item.targetRevision;
    if (item.kind === 'lesson' && plan.fetchLessons.includes(item.id)) item.targetRevision = index.lessons[item.id]?.revision ?? item.targetRevision;
  }

  // 2) Cursos. Una lección nueva, cambiada o quitada deja viejo el currículo de su curso.
  const courses = new Set(plan.fetchCourses);
  for (const lessonId of [...plan.fetchLessons, ...plan.removeLessons]) {
    const courseId = index.lessons[lessonId]?.courseId ?? previous.lessons[lessonId]?.courseId;
    if (courseId && index.courses[courseId] !== undefined) courses.add(courseId);
  }
  const lessons = new Set(plan.fetchLessons);
  // Pendientes cuya espera venció: se reintentan aunque la respuesta venga vacía.
  for (const item of pending.values()) {
    if (item.nextAttemptAt > now) continue;
    if (item.kind === 'course') courses.add(item.id);
    else lessons.add(item.id);
  }

  let attempted = 0;
  let failed = 0;
  let fromServer = 0;
  let lastError: unknown = null;
  const announced = (kind: PendingItem['kind'], id: number) =>
    kind === 'course' ? plan.fetchCourses.includes(id) : plan.fetchLessons.includes(id);

  const recordFailure = (kind: PendingItem['kind'], id: number, courseId: number, target: number, reason: unknown, newCourse: boolean) => {
    const before = pending.get(key(kind, id));
    const attempts = (before?.attempts ?? 0) + 1;
    // Tras 10 intentos sigue pendiente, pero ya no cuenta como fallo de la sincronización.
    if ((before?.attempts ?? 0) < MAX_BLOCKING_ATTEMPTS) failed += 1;
    lastError = reason;
    pending.set(key(kind, id), {
      kind,
      id,
      courseId,
      targetRevision: target,
      attempts,
      lastError: errorText(reason).slice(0, 300),
      nextAttemptAt: now + retryDelayMs(attempts),
      newCourse: before?.newCourse || newCourse,
    });
  };

  const isGone = (reason: unknown) => {
    const status = errorStatus(reason);
    return status === 404 || status === 403;
  };

  await inBatches([...courses], async (courseId) => {
    const before = pending.get(key('course', courseId));
    if ((before?.attempts ?? 0) < MAX_BLOCKING_ATTEMPTS) attempted += 1;
    if (announced('course', courseId)) fromServer += 1;
    const isNew = plan.newCourses.includes(courseId) || Boolean(before?.newCourse);
    const target = announced('course', courseId) ? index.courses[courseId] ?? 0 : before?.targetRevision ?? index.courses[courseId] ?? 0;
    try {
      const detail = await deps.syncCourse(courseId);
      index.courses[courseId] = detail.revision ?? target;
      pending.delete(key('course', courseId));
      if (isNew) {
        for (const lessonId of detail.lessonIds) {
          if (!index.lessons[lessonId]) {
            index.lessons[lessonId] = { courseId, revision: 0 };
            lessons.add(lessonId);
          }
        }
      }
    } catch (reason) {
      if (before && isGone(reason)) {
        // El curso ya no existe o ya no hay acceso: baja local.
        await deps.removeCourse(courseId);
        delete index.courses[courseId];
        pending.delete(key('course', courseId));
        removed += 1;
        if ((before.attempts ?? 0) < MAX_BLOCKING_ATTEMPTS) attempted -= 1;
        return;
      }
      recordFailure('course', courseId, courseId, target, reason, isNew);
      // Revisión anterior (o 0 si era nuevo): la próxima vez se vuelve a pedir.
      index.courses[courseId] = previous.courses[courseId] ?? 0;
    }
  });

  // 3) Lecciones: solo lo liviano.
  await inBatches([...lessons], async (lessonId) => {
    const before = pending.get(key('lesson', lessonId));
    if ((before?.attempts ?? 0) < MAX_BLOCKING_ATTEMPTS) attempted += 1;
    if (announced('lesson', lessonId)) fromServer += 1;
    const known = index.lessons[lessonId];
    const target = announced('lesson', lessonId) ? known?.revision ?? 0 : before?.targetRevision ?? known?.revision ?? 0;
    try {
      const lesson = await deps.syncLesson(lessonId);
      index.lessons[lessonId] = { courseId: lesson.courseId || known?.courseId || before?.courseId || 0, revision: lesson.revision ?? target };
      pending.delete(key('lesson', lessonId));
    } catch (reason) {
      if (before && isGone(reason)) {
        // La lección ya no existe o ya no hay acceso: baja local.
        await deps.removeLesson(lessonId);
        delete index.lessons[lessonId];
        pending.delete(key('lesson', lessonId));
        removed += 1;
        if ((before.attempts ?? 0) < MAX_BLOCKING_ATTEMPTS) attempted -= 1;
        return;
      }
      const prior = previous.lessons[lessonId];
      const courseId = known?.courseId ?? prior?.courseId ?? before?.courseId ?? 0;
      recordFailure('lesson', lessonId, courseId, target, reason, false);
      index.lessons[lessonId] = { courseId, revision: prior?.revision ?? 0 };
    }
  });

  // Fallaron todos los pedidos que trajo el servidor: no se guarda nada (el cursor no avanza).
  if (fromServer > 0 && attempted > 0 && failed === attempted) {
    throw new SyncAllFailedError(lastError);
  }

  return { index, fetched: attempted - failed, removed, failed, pending: [...pending.values()] };
}
