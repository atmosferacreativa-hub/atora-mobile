import type {
  EnqueueInput,
  ErrorClass,
  OutboxEvent,
  OutboxHandler,
  OutboxStore,
  ProcessResult,
} from './types';

export const BASE_DELAY_MS = 5_000;
export const MAX_DELAY_MS = 30 * 60_000;

/** Espera creciente: 5 s, 10 s, 20 s… hasta 30 min. */
export function backoffDelay(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

export function classifyStatus(status: number): ErrorClass {
  if (status === 0 || status === 408 || status === 429 || status >= 500) return 'retry';
  if (status === 401) return 'auth';
  if (status >= 400) return 'definitive';
  return 'retry';
}

/** Encola sin duplicar: si ya existe la misma clave, devuelve el evento existente. */
export async function enqueue<P>(store: OutboxStore, input: EnqueueInput<P>, now: number): Promise<OutboxEvent<P>> {
  const existing = await store.findByDedupe(input.userId, input.dedupeKey);
  if (existing) return existing as OutboxEvent<P>;
  const event: OutboxEvent<P> = {
    id: input.id,
    userId: input.userId,
    type: input.type,
    dedupeKey: input.dedupeKey,
    payload: input.payload,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    createdAt: input.createdAt ?? now,
    lastError: '',
  };
  if (!(await store.insert(event))) {
    const winner = await store.findByDedupe(input.userId, input.dedupeKey);
    if (winner) return winner as OutboxEvent<P>;
  }
  return event;
}

/**
 * Procesa los eventos pendientes y vencidos del usuario, en orden de creación.
 * - éxito: el evento sale de la cola;
 * - error reintentable: queda pendiente con espera creciente;
 * - error definitivo: queda como "failed" (visible) hasta que el usuario lo descarte;
 * - 401: se detiene sin tocar nada (la sesión decide).
 */
export async function processQueue(
  store: OutboxStore,
  userId: number,
  now: number,
  handlers: Record<string, OutboxHandler>,
  classify: (reason: unknown) => ErrorClass,
  describe: (reason: unknown) => string = (reason) => (reason instanceof Error ? reason.message : String(reason)),
): Promise<ProcessResult> {
  const result: ProcessResult = { done: 0, retried: 0, failed: 0, stoppedForAuth: false };
  const events = await store.list(userId);

  for (const event of events) {
    if (event.status !== 'pending' || event.nextAttemptAt > now) continue;
    const handler = handlers[event.type];
    if (!handler) continue;

    let current = event;
    try {
      await handler(current, {
        save: async (payload) => {
          current = { ...current, payload };
          await store.update(current.id, { payload });
        },
      });
      await store.remove(event.id);
      result.done += 1;
    } catch (reason) {
      const kind = classify(reason);
      if (kind === 'auth') {
        result.stoppedForAuth = true;
        break;
      }
      const attempts = current.attempts + 1;
      if (kind === 'definitive') {
        await store.update(event.id, { status: 'failed', attempts, lastError: describe(reason) });
        result.failed += 1;
      } else {
        await store.update(event.id, { attempts, nextAttemptAt: now + backoffDelay(attempts), lastError: describe(reason) });
        result.retried += 1;
      }
    }
  }
  return result;
}

export async function pendingEvents(store: OutboxStore, userId: number): Promise<OutboxEvent[]> {
  return (await store.list(userId)).filter((event) => event.status === 'pending');
}

export async function failedEvents(store: OutboxStore, userId: number): Promise<OutboxEvent[]> {
  return (await store.list(userId)).filter((event) => event.status === 'failed');
}
