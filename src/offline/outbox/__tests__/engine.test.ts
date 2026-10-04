import { BASE_DELAY_MS, backoffDelay, classifyStatus, enqueue, failedEvents, pendingEvents, processQueue } from '../engine';
import type { OutboxEvent, OutboxStore } from '../types';

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

async function only(store: MemoryStore): Promise<OutboxEvent> {
  const [event] = await store.list(1);
  if (!event) throw new Error('cola vacía');
  return event;
}

const input = (id: string, dedupeKey = id, userId = 1) => ({ id, userId, type: 'test', dedupeKey, payload: { n: 1 } });

describe('outbox', () => {
  it('encola y no duplica la misma clave', async () => {
    const store = new MemoryStore();
    const first = await enqueue(store, input('evt-1', 'lesson:7'), 1000);
    const again = await enqueue(store, input('evt-2', 'lesson:7'), 2000);
    expect(again.id).toBe(first.id);
    expect(await pendingEvents(store, 1)).toHaveLength(1);
  });

  it('evento reemplazable: por clave queda solo el último, con su propio id', async () => {
    const store = new MemoryStore();
    await enqueue(store, { ...input('pos-1', 'position:7'), payload: { s: 10 }, replace: true }, 1000);
    await enqueue(store, { ...input('pos-2', 'position:7'), payload: { s: 20 }, replace: true }, 2000);
    await enqueue(store, { ...input('pos-3', 'position:8'), payload: { s: 5 }, replace: true }, 3000);
    const events = await store.list(1);
    expect(events.map((e) => [e.id, e.payload])).toEqual([['pos-2', { s: 20 }], ['pos-3', { s: 5 }]]);
  });

  it('reemplazar no cambia el comportamiento de los demás eventos', async () => {
    const store = new MemoryStore();
    await enqueue(store, input('done-1', 'lesson:7'), 1000);
    await enqueue(store, { ...input('pos-1', 'position:7'), replace: true }, 1500);
    const again = await enqueue(store, input('done-2', 'lesson:7'), 2000);
    expect(again.id).toBe('done-1');
    expect((await store.list(1)).map((e) => e.id)).toEqual(['done-1', 'pos-1']);
  });

  it('si el envío del reemplazado termina después, no borra al nuevo', async () => {
    const store = new MemoryStore();
    await enqueue(store, { ...input('pos-1', 'position:7'), replace: true }, 0);
    const result = await processQueue(store, 1, 0, {
      test: async () => {
        // Mientras se envía pos-1, el reproductor guarda una posición nueva.
        await enqueue(store, { ...input('pos-2', 'position:7'), replace: true }, 1);
      },
    }, classify);
    expect(result.done).toBe(1);
    expect((await store.list(1)).map((e) => e.id)).toEqual(['pos-2']);
  });

  it('un evento exitoso sale de la cola y el client_event_id llega intacto', async () => {
    const store = new MemoryStore();
    await enqueue(store, input('evt-ok'), 0);
    const seen: string[] = [];
    const result = await processQueue(store, 1, 0, { test: async (e) => { seen.push(e.id); } }, classify);
    expect(result.done).toBe(1);
    expect(seen).toEqual(['evt-ok']);
    expect(await store.list(1)).toHaveLength(0);
  });

  it('error de red: el evento permanece con espera creciente y mismo id', async () => {
    const store = new MemoryStore();
    await enqueue(store, input('evt-net'), 0);
    const fail = { test: async () => { throw new HttpError(0); } };

    await processQueue(store, 1, 0, fail, classify);
    let event = await only(store);
    expect(event.status).toBe('pending');
    expect(event.attempts).toBe(1);
    expect(event.nextAttemptAt).toBe(BASE_DELAY_MS);

    // Antes de vencer la espera no se reintenta.
    const calls: number[] = [];
    await processQueue(store, 1, BASE_DELAY_MS - 1, { test: async () => { calls.push(1); } }, classify);
    expect(calls).toHaveLength(0);

    await processQueue(store, 1, BASE_DELAY_MS, fail, classify);
    event = await only(store);
    expect(event.id).toBe('evt-net');
    expect(event.attempts).toBe(2);
    expect(event.nextAttemptAt).toBe(BASE_DELAY_MS + backoffDelay(2));
  });

  it.each([403, 409, 422])('error definitivo %i: se descarta de forma visible', async (status) => {
    const store = new MemoryStore();
    await enqueue(store, input('evt-bad'), 0);
    const result = await processQueue(store, 1, 0, { test: async () => { throw new HttpError(status); } }, classify);
    expect(result.failed).toBe(1);
    expect(await pendingEvents(store, 1)).toHaveLength(0);
    const failed = await failedEvents(store, 1);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.lastError).toBe(`HTTP ${status}`);
    // Un descartado no se vuelve a enviar.
    const again = await processQueue(store, 1, 10 ** 9, { test: async () => undefined }, classify);
    expect(again.done).toBe(0);
  });

  it('401 detiene el procesamiento sin modificar eventos', async () => {
    const store = new MemoryStore();
    await enqueue(store, input('a'), 0);
    await enqueue(store, input('b'), 1);
    const result = await processQueue(store, 1, 5, { test: async () => { throw new HttpError(401); } }, classify);
    expect(result.stoppedForAuth).toBe(true);
    expect((await store.list(1)).map((e) => [e.id, e.attempts, e.status])).toEqual([['a', 0, 'pending'], ['b', 0, 'pending']]);
  });

  it('el progreso parcial guardado sobrevive a un fallo de red', async () => {
    const store = new MemoryStore();
    await enqueue(store, input('upload'), 0);
    await processQueue(store, 1, 0, {
      test: async (_e, ctx) => {
        await ctx.save({ n: 42 });
        throw new HttpError(503);
      },
    }, classify);
    const event = await only(store);
    expect(event.payload).toEqual({ n: 42 });
    expect(event.status).toBe('pending');
  });

  it('cada usuario solo procesa su propia cola', async () => {
    const store = new MemoryStore();
    await enqueue(store, input('u1', 'k', 1), 0);
    await enqueue(store, input('u2', 'k', 2), 0);
    const seen: number[] = [];
    await processQueue(store, 2, 0, { test: async (e) => { seen.push(e.userId); } }, classify);
    expect(seen).toEqual([2]);
    expect(await store.list(1)).toHaveLength(1);
  });

  it('la espera crece y tiene tope', () => {
    expect([1, 2, 3].map(backoffDelay)).toEqual([5_000, 10_000, 20_000]);
    expect(backoffDelay(50)).toBe(30 * 60_000);
  });
});
