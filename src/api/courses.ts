import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, apiRequest } from './client';
import type { CourseDetail, CourseSummary, LessonDetail } from '../types';

const COURSE_CACHE = 'atora.cache.course.';
const LESSON_CACHE = 'atora.cache.lesson.';
const COMPLETION_QUEUE = 'atora.queue.lesson-completions.v1';

type QueuedCompletion = { lessonId: number; queuedAt: number };

async function cachedRequest<T>(path: string, cacheKey: string, token: string): Promise<T> {
  try {
    const data = await apiRequest<T>(path, { token });
    await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
  } catch (reason) {
    if (reason instanceof ApiError) throw reason;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (!cached) throw reason;
    return JSON.parse(cached) as T;
  }
}

export async function fetchCourses(token: string): Promise<CourseSummary[]> {
  const response = await cachedRequest<{ items: CourseSummary[] }>('courses', `${COURSE_CACHE}all`, token);
  return response.items;
}

export function fetchCourse(courseId: number, token: string): Promise<CourseDetail> {
  return cachedRequest<CourseDetail>(`courses/${courseId}`, `${COURSE_CACHE}${courseId}`, token);
}

export async function fetchLesson(lessonId: number, token: string): Promise<LessonDetail> {
  const response = await cachedRequest<{ lesson: LessonDetail }>(
    `lessons/${lessonId}`,
    `${LESSON_CACHE}${lessonId}`,
    token,
  );
  return response.lesson;
}

export async function completeLesson(
  lessonId: number,
  token: string,
): Promise<{ completed: boolean; queued: boolean }> {
  try {
    const result = await apiRequest<{ completed: boolean }>(`lessons/${lessonId}/complete`, {
      method: 'POST',
      token,
    });
    return { completed: result.completed, queued: false };
  } catch (reason) {
    if (reason instanceof ApiError) throw reason;
    await queueCompletion(lessonId);
    return { completed: true, queued: true };
  }
}

export async function flushPendingCompletions(token: string): Promise<number> {
  const queue = await readQueue();
  const remaining: QueuedCompletion[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      await apiRequest(`lessons/${item.lessonId}/complete`, { method: 'POST', token });
      synced += 1;
    } catch (reason) {
      if (!(reason instanceof ApiError)) remaining.push(item);
    }
  }

  await AsyncStorage.setItem(COMPLETION_QUEUE, JSON.stringify(remaining));
  return synced;
}

async function queueCompletion(lessonId: number): Promise<void> {
  const queue = await readQueue();
  if (!queue.some((item) => item.lessonId === lessonId)) {
    queue.push({ lessonId, queuedAt: Date.now() });
  }
  await AsyncStorage.setItem(COMPLETION_QUEUE, JSON.stringify(queue));
}

async function readQueue(): Promise<QueuedCompletion[]> {
  const raw = await AsyncStorage.getItem(COMPLETION_QUEUE);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
