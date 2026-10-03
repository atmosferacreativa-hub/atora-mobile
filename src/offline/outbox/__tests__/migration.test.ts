import { enqueue } from '../engine';
import { legacyCacheEntry, legacyCompletionsToEvents, legacyQueueOwner } from '../migration';
import type { OutboxEvent, OutboxStore } from '../types';

describe('migración desde 0.2.0', () => {
  it('identifica al dueño de la cola por la clave, o por la sesión si la clave no lo trae', () => {
    expect(legacyQueueOwner('atora.queue.u12.lesson-completions.v1', null)).toBe(12);
    expect(legacyQueueOwner('atora.queue.lesson-completions.v1', 7)).toBe(7);
    expect(legacyQueueOwner('atora.queue.lesson-completions.v1', null)).toBeNull();
    expect(legacyQueueOwner('atora.cache.u12.course.all', 12)).toBeNull();
  });

  it('convierte cada lección pendiente en un evento estable, sin perder ni duplicar', () => {
    const raw = JSON.stringify([
      { lessonId: 5, queuedAt: 1700000000000 },
      { lessonId: 9, queuedAt: 1700000001000 },
      { lessonId: 5, queuedAt: 1700000002000 },
      { lessonId: 'x' },
    ]);
    const events = legacyCompletionsToEvents(12, raw);
    expect(events.map((e) => [e.id, e.dedupeKey, e.payload.lessonId, e.createdAt])).toEqual([
      ['legacy-lc-12-5', 'lesson_completion:5', 5, 1700000000000],
      ['legacy-lc-12-9', 'lesson_completion:9', 9, 1700000001000],
    ]);
    expect(legacyCompletionsToEvents(12, 'no-json')).toEqual([]);
    expect(legacyCompletionsToEvents(12, null)).toEqual([]);
  });

  it('repetir la migración no duplica pendientes', async () => {
    const rows: OutboxEvent[] = [];
    const store: OutboxStore = {
      insert: async (e) => (rows.some((r) => r.userId === e.userId && r.dedupeKey === e.dedupeKey) ? false : (rows.push(e), true)),
      findByDedupe: async (u, k) => rows.find((r) => r.userId === u && r.dedupeKey === k) ?? null,
      list: async (u) => rows.filter((r) => r.userId === u),
      update: async () => undefined,
      remove: async () => undefined,
    };
    const raw = JSON.stringify([{ lessonId: 5, queuedAt: 1 }]);
    for (let i = 0; i < 2; i += 1) {
      for (const event of legacyCompletionsToEvents(12, raw)) await enqueue(store, event, 100);
    }
    expect(rows).toHaveLength(1);
  });

  it('mapea las claves de caché 0.2.0 respetando el usuario', () => {
    expect(legacyCacheEntry('atora.cache.u3.course.all', null)).toEqual({ userId: 3, kind: 'courses', entityId: 0 });
    expect(legacyCacheEntry('atora.cache.u3.course.44', null)).toEqual({ userId: 3, kind: 'course', entityId: 44 });
    expect(legacyCacheEntry('atora.cache.u3.lesson.8', null)).toEqual({ userId: 3, kind: 'lesson', entityId: 8 });
    expect(legacyCacheEntry('atora.cache.u3.dashboard.v1', null)).toEqual({ userId: 3, kind: 'dashboard', entityId: 0 });
    expect(legacyCacheEntry('atora.cache.dashboard.v1', 4)).toEqual({ userId: 4, kind: 'dashboard', entityId: 0 });
    expect(legacyCacheEntry('atora.cache.u3.mode.v1', 3)).toBeNull();
  });
});
