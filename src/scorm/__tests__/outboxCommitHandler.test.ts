import { BASE_DELAY_MS, classifyStatus, enqueue, failedEvents, pendingEvents, processQueue } from '../../offline/outbox/engine';
import type { OutboxEvent, OutboxStore } from '../../offline/outbox/types';
import { buildScormCommitBody, createScormCommitOutboxHandler } from '../outboxCommitHandler';

class MemoryStore implements OutboxStore {
  events = new Map<string, OutboxEvent>();
  async insert(event: OutboxEvent) {
    if (await this.findByDedupe(event.userId, event.dedupeKey)) return false;
    this.events.set(event.id, { ...event });
    return true;
  }
  async findByDedupe(userId: number, dedupeKey: string) {
    return [...this.events.values()].find((e) => e.userId === userId && e.dedupeKey === dedupeKey) ?? null;
  }
  async list(userId: number) {
    return [...this.events.values()].filter((e) => e.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
  }
  async update(id: string, patch: Partial<OutboxEvent>) {
    const current = this.events.get(id);
    if (current) this.events.set(id, { ...current, ...patch });
  }
  async remove(id: string) {
    this.events.delete(id);
  }
}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

const classify = (reason: unknown) => classifyStatus(reason instanceof HttpError ? reason.status : 0);

describe('SCORM outbox handler', () => {
  it('incluye client_event_id y device_time en el body', async () => {
    const store = new MemoryStore();
    const commit = jest.fn<Promise<void>, [number, any]>(async () => undefined);
    const handler = createScormCommitOutboxHandler(commit);

    await enqueue(store, {
      id: 'evt-1',
      userId: 1,
      type: 'scorm.commit',
      dedupeKey: 'scorm.commit:1:evt-1',
      payload: { attemptId: 77, values: { a: '1' }, deviceTime: '2026-10-24T00:00:00.000Z' },
    }, 0);

    await processQueue(store, 1, 0, { 'scorm.commit': handler }, classify);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]?.[0]).toBe(77);
    expect(commit.mock.calls[0]?.[1]).toEqual({ values: { a: '1' }, client_event_id: 'evt-1', device_time: '2026-10-24T00:00:00.000Z' });
    expect(await store.list(1)).toHaveLength(0);
  });

  it('409 definitivo: queda failed y no reintenta', async () => {
    const store = new MemoryStore();
    const commit = jest.fn<Promise<void>, [number, any]>(async () => { throw new HttpError(409); });
    const handler = createScormCommitOutboxHandler(commit);

    await enqueue(store, {
      id: 'evt-409',
      userId: 1,
      type: 'scorm.commit',
      dedupeKey: 'k',
      payload: { attemptId: 7, values: {}, deviceTime: '2026-10-24T00:00:00.000Z' },
    }, 0);

    const result = await processQueue(store, 1, 0, { 'scorm.commit': handler }, classify);
    expect(result.failed).toBe(1);
    expect(await pendingEvents(store, 1)).toHaveLength(0);
    const failed = await failedEvents(store, 1);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.status).toBe('failed');
    expect(failed[0]?.attempts).toBe(1);
  });

  it('error de red (status 0): queda pending con backoff', async () => {
    const store = new MemoryStore();
    const commit = jest.fn<Promise<void>, [number, any]>(async () => { throw new HttpError(0); });
    const handler = createScormCommitOutboxHandler(commit);

    await enqueue(store, {
      id: 'evt-net',
      userId: 1,
      type: 'scorm.commit',
      dedupeKey: 'k',
      payload: { attemptId: 7, values: {}, deviceTime: '2026-10-24T00:00:00.000Z' },
    }, 0);

    await processQueue(store, 1, 0, { 'scorm.commit': handler }, classify);
    const [event] = await store.list(1);
    expect(event?.status).toBe('pending');
    expect(event?.attempts).toBe(1);
    expect(event?.nextAttemptAt).toBe(BASE_DELAY_MS);
  });

  it('buildScormCommitBody: event.id sale como client_event_id', () => {
    const body = buildScormCommitBody({
      id: 'evt-x',
      userId: 1,
      type: 'scorm.commit',
      dedupeKey: 'k',
      payload: { attemptId: 7, values: { k: 'v' }, deviceTime: '2026-10-24T00:00:00.000Z' },
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: 0,
      lastError: '',
    });
    expect(body.client_event_id).toBe('evt-x');
    expect(body.device_time).toBe('2026-10-24T00:00:00.000Z');
    expect(body.values).toEqual({ k: 'v' });
  });
});

