import { ApiError, isRetriableError } from './client';
import { authenticatedRequest } from './authenticated';
import { getSessionUserId } from './session';
import { cacheGet, cacheSet } from '../offline/localCache';
import { baseline, coursesWithNewGrades, markSeen, type SeenGrades } from '../offline/newGrades';
import type { CourseGradesDetail, GradesSummary } from '../types';

/**
 * Notas del estudiante (0.5.0, plugin 6.29.0). Solo notas liberadas: la regla
 * vive en el servidor, la app muestra lo que recibe. Sin conexión se usa lo
 * último sincronizado, con su fecha.
 */
export type Synced<T> = { data: T; syncedAt: number; fromCache: boolean };

const SEEN_ENTITY = 1;

async function withCache<T>(path: string, kind: 'grades' | 'course_grades', entityId: number, token: string): Promise<Synced<T>> {
  const userId = await getSessionUserId();
  try {
    const data = await authenticatedRequest<T>(path, { token });
    const syncedAt = Date.now();
    if (userId) await cacheSet(userId, kind, entityId, { data, syncedAt }).catch(() => undefined);
    return { data, syncedAt, fromCache: false };
  } catch (reason) {
    if (reason instanceof ApiError && !isRetriableError(reason)) throw reason;
    const cached = userId ? await cacheGet<{ data: T; syncedAt: number }>(userId, kind, entityId).catch(() => null) : null;
    if (!cached) throw reason;
    return { ...cached, fromCache: true };
  }
}

export function fetchGrades(token: string): Promise<Synced<GradesSummary>> {
  return withCache<GradesSummary>('grades', 'grades', 0, token);
}

export function fetchCourseGrades(courseId: number, token: string): Promise<Synced<CourseGradesDetail>> {
  return withCache<CourseGradesDetail>(`courses/${courseId}/grades`, 'course_grades', courseId, token);
}

async function readSeen(userId: number): Promise<SeenGrades | null> {
  return cacheGet<SeenGrades>(userId, 'grades', SEEN_ENTITY).catch(() => null);
}

/** Cursos con una calificación nueva que el estudiante no vio (distintivo en Yo y en el curso). */
export async function newGradeCourseIds(summary: GradesSummary): Promise<number[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  const stored = await readSeen(userId);
  const seen = baseline(stored, summary.courses);
  if (!stored) await cacheSet(userId, 'grades', SEEN_ENTITY, seen).catch(() => undefined);
  return coursesWithNewGrades(seen, summary.courses);
}

/** Al ver las notas: el aviso se apaga para esos cursos (o para todos). */
export async function markGradesSeen(summary: GradesSummary, only?: number[]): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) return;
  const seen = baseline(await readSeen(userId), summary.courses);
  await cacheSet(userId, 'grades', SEEN_ENTITY, markSeen(seen, summary.courses, only)).catch(() => undefined);
}
