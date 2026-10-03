import { ApiError, isRetriableError } from './client';
import { authenticatedRequest } from './authenticated';
import { getSessionUserId } from './session';
import { cacheGet, cacheSet, type CacheKind } from '../offline/localCache';
import { LESSON_COMPLETION, lessonCompletionDedupeKey } from '../offline/outbox/migration';
import { enqueueEvent, newEventId, registerOutboxHandler } from '../offline/outbox/runtime';
import type { CourseDetail, CourseSummary, LessonDetail } from '../types';

async function cachedRequest<T>(path: string, kind: CacheKind, entityId: number, token: string): Promise<T> {
  const userId = await getSessionUserId();
  try {
    const data = await authenticatedRequest<T>(path, { token });
    if (userId) await cacheSet(userId, kind, entityId, data).catch(() => undefined);
    return data;
  } catch (reason) {
    if (reason instanceof ApiError && !isRetriableError(reason)) throw reason;
    const cached = userId ? await cacheGet<T>(userId, kind, entityId).catch(() => null) : null;
    if (!cached) throw reason;
    return cached;
  }
}

export async function fetchCourses(token: string): Promise<CourseSummary[]> {
  const response = await cachedRequest<{ items: CourseSummary[] }>('courses', 'courses', 0, token);
  return response.items;
}

export async function fetchCourse(courseId: number, token: string): Promise<CourseDetail> {
  return cachedRequest<CourseDetail>(`courses/${courseId}`, 'course', courseId, token);
}

export async function fetchLesson(lessonId: number, token: string): Promise<LessonDetail> {
  const response = await cachedRequest<{ lesson: LessonDetail }>(`lessons/${lessonId}`, 'lesson', lessonId, token);
  return response.lesson;
}

registerOutboxHandler<{ lessonId: number }>(LESSON_COMPLETION, async (event, { token }) => {
  await authenticatedRequest(`lessons/${event.payload.lessonId}/complete`, { method: 'POST', token });
});

export async function completeLesson(
  lessonId: number,
  token: string,
): Promise<{ completed: boolean; queued: boolean }> {
  try {
    const result = await authenticatedRequest<{ completed: boolean }>(`lessons/${lessonId}/complete`, {
      method: 'POST',
      token,
    });
    return { completed: result.completed, queued: false };
  } catch (reason) {
    if (reason instanceof ApiError && !isRetriableError(reason)) throw reason;
    await enqueueEvent({
      id: newEventId(),
      type: LESSON_COMPLETION,
      dedupeKey: lessonCompletionDedupeKey(lessonId),
      payload: { lessonId },
    });
    return { completed: true, queued: true };
  }
}
