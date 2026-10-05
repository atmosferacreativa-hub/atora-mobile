import type { EnqueueInput } from './types';

/**
 * Migración desde 0.2.0 (AsyncStorage) a la base local. Módulo puro.
 *
 * Cola 0.2.0: `atora.queue.u{id}.lesson-completions.v1` (o sin `u{id}` si se
 * encoló sin sesión) con `[{ lessonId, queuedAt }]`.
 * Caché 0.2.0: `atora.cache.u{id}.course.all|course.{id}|lesson.{id}|dashboard.v1`.
 */

export const LESSON_COMPLETION = 'lesson_completion';

export type CacheKind = 'dashboard' | 'courses' | 'course' | 'lesson' | 'assignment' | 'video_thumb' | 'quiz_draft' | 'grades' | 'course_grades' | 'certificates';

export function lessonCompletionDedupeKey(lessonId: number): string {
  return `${LESSON_COMPLETION}:${lessonId}`;
}

const QUEUE_KEY = /^atora\.queue\.(?:u(\d+)\.)?lesson-completions\.v1$/;
const CACHE_KEY = /^atora\.cache\.(?:u(\d+)\.)?(dashboard\.v1|course\.all|course\.(\d+)|lesson\.(\d+))$/;

function owner(match: string | undefined, sessionUserId: number | null): number | null {
  const id = match ? Number(match) : sessionUserId ?? 0;
  return id > 0 ? id : null;
}

/** Usuario dueño de una cola 0.2.0, o null si la clave no es una cola o no hay a quién asignarla. */
export function legacyQueueOwner(key: string, sessionUserId: number | null): number | null {
  const match = QUEUE_KEY.exec(key);
  return match ? owner(match[1], sessionUserId) : null;
}

export function legacyCompletionsToEvents(userId: number, raw: string | null): EnqueueInput<{ lessonId: number }>[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<number>();
  const events: EnqueueInput<{ lessonId: number }>[] = [];
  for (const item of parsed) {
    const lessonId = Number((item as { lessonId?: unknown })?.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0 || seen.has(lessonId)) continue;
    seen.add(lessonId);
    const queuedAt = Number((item as { queuedAt?: unknown })?.queuedAt);
    events.push({
      // Estable: si la migración se repite, no duplica.
      id: `legacy-lc-${userId}-${lessonId}`,
      userId,
      type: LESSON_COMPLETION,
      dedupeKey: lessonCompletionDedupeKey(lessonId),
      payload: { lessonId },
      createdAt: Number.isFinite(queuedAt) && queuedAt > 0 ? queuedAt : undefined,
    });
  }
  return events;
}

export type LegacyCacheEntry = { userId: number; kind: CacheKind; entityId: number };

export function legacyCacheEntry(key: string, sessionUserId: number | null): LegacyCacheEntry | null {
  const match = CACHE_KEY.exec(key);
  if (!match) return null;
  const userId = owner(match[1], sessionUserId);
  if (!userId) return null;
  const name = match[2];
  if (name === 'dashboard.v1') return { userId, kind: 'dashboard', entityId: 0 };
  if (name === 'course.all') return { userId, kind: 'courses', entityId: 0 };
  if (match[3]) return { userId, kind: 'course', entityId: Number(match[3]) };
  return { userId, kind: 'lesson', entityId: Number(match[4]) };
}
