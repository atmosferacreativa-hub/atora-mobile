/**
 * Aplicar un plan de sincronización (0.4.1). Módulo puro: las operaciones de
 * red y almacenamiento se inyectan, para probarlo con Jest.
 *
 * Si falla cualquier paso de una lección (detalle, consigna, recursos) o de un
 * curso, ese objeto **no** guarda su revisión nueva: conserva la anterior (o 0
 * si era nuevo), así la próxima sincronización lo vuelve a pedir aunque el
 * cursor haya avanzado. Si fallan todos los pedidos, se lanza el error y no se
 * guarda nada.
 */
import type { LocalIndex, SyncPlan } from './plan';

export type ApplyDeps = {
  removeLesson(lessonId: number): Promise<void>;
  removeCourse(courseId: number): Promise<void>;
  /** Detalle y currículo; lanza si falla. */
  syncCourse(courseId: number): Promise<{ revision?: number; lessonIds: number[] }>;
  /** Detalle, consigna y recursos; lanza si falla cualquiera. */
  syncLesson(lessonId: number): Promise<{ courseId: number; revision?: number }>;
};

export type ApplyResult = { index: LocalIndex; fetched: number; removed: number; failed: number };

export class SyncAllFailedError extends Error {
  constructor(readonly cause: unknown) {
    super('No se pudo traer ningún cambio.');
  }
}

const CONCURRENCY = 3;

async function inBatches<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(task));
  }
}

export async function applyPlan(plan: SyncPlan, previous: LocalIndex, deps: ApplyDeps): Promise<ApplyResult> {
  const index: LocalIndex = { courses: { ...plan.index.courses }, lessons: { ...plan.index.lessons } };

  // 1) Bajas: contenido y descargas locales.
  for (const lessonId of plan.removeLessons) await deps.removeLesson(lessonId);
  for (const courseId of plan.removeCourses) await deps.removeCourse(courseId);

  // 2) Cursos. Una lección nueva, cambiada o quitada deja viejo el currículo de su curso.
  const courses = new Set(plan.fetchCourses);
  for (const lessonId of [...plan.fetchLessons, ...plan.removeLessons]) {
    const courseId = index.lessons[lessonId]?.courseId ?? previous.lessons[lessonId]?.courseId;
    if (courseId && index.courses[courseId] !== undefined) courses.add(courseId);
  }
  const lessons = new Set(plan.fetchLessons);
  let attempted = 0;
  let failed = 0;
  let lastError: unknown = null;

  await inBatches([...courses], async (courseId) => {
    attempted += 1;
    try {
      const detail = await deps.syncCourse(courseId);
      index.courses[courseId] = detail.revision ?? index.courses[courseId] ?? 0;
      if (plan.newCourses.includes(courseId)) {
        for (const lessonId of detail.lessonIds) {
          if (!index.lessons[lessonId]) {
            index.lessons[lessonId] = { courseId, revision: 0 };
            lessons.add(lessonId);
          }
        }
      }
    } catch (reason) {
      failed += 1;
      lastError = reason;
      // Revisión anterior (o 0 si era nuevo): la próxima vez se vuelve a pedir.
      index.courses[courseId] = previous.courses[courseId] ?? 0;
    }
  });

  // 3) Lecciones: solo lo liviano.
  await inBatches([...lessons], async (lessonId) => {
    attempted += 1;
    try {
      const lesson = await deps.syncLesson(lessonId);
      const known = index.lessons[lessonId];
      index.lessons[lessonId] = { courseId: lesson.courseId || known?.courseId || 0, revision: lesson.revision ?? known?.revision ?? 0 };
    } catch (reason) {
      failed += 1;
      lastError = reason;
      const before = previous.lessons[lessonId];
      const courseId = index.lessons[lessonId]?.courseId ?? before?.courseId ?? 0;
      index.lessons[lessonId] = { courseId, revision: before?.revision ?? 0 };
    }
  });

  if (attempted > 0 && failed === attempted) {
    throw new SyncAllFailedError(lastError);
  }

  return { index, fetched: attempted - failed, removed: plan.removeCourses.length + plan.removeLessons.length, failed };
}
