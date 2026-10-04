import * as Crypto from 'expo-crypto';
import { ApiError } from '../../api/client';
import { getSessionUserId } from '../../api/session';
import { deleteEventFiles } from '../outboxFiles';
import { classifyStatus, enqueue, failedEvents, pendingEvents, processQueue } from './engine';
import { sqliteOutboxStore } from './sqliteStore';
import type { EnqueueInput, ErrorClass, OutboxEvent, OutboxHandler, ProcessResult } from './types';

/** Error local sin arreglo posible (p. ej. el archivo ya no existe): descarte visible. */
export class OutboxDefinitiveError extends Error {}

export type OutboxHandlerWithToken<P = any> = (
  event: OutboxEvent<P>,
  context: { save: (payload: P) => Promise<void>; token: string },
) => Promise<void>;

const handlers: Record<string, OutboxHandlerWithToken> = {};
const listeners = new Set<() => void>();
let flushing: Promise<ProcessResult | null> | null = null;

export function newEventId(): string {
  return Crypto.randomUUID();
}

export function registerOutboxHandler<P>(type: string, handler: OutboxHandlerWithToken<P>): void {
  handlers[type] = handler as OutboxHandlerWithToken;
}

/** Avisa a las pantallas cuando la cola cambia. */
export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Una pantalla desmontada no debe romper la cola.
    }
  });
}

export function classifyOutboxError(reason: unknown): ErrorClass {
  if (reason instanceof OutboxDefinitiveError) return 'definitive';
  if (reason instanceof ApiError) return classifyStatus(reason.status);
  return 'retry';
}

export async function enqueueEvent<P>(input: Omit<EnqueueInput<P>, 'userId'>): Promise<OutboxEvent<P> | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const event = await enqueue(sqliteOutboxStore, { ...input, userId }, Date.now());
  notify();
  return event;
}

let flushAgain = false;

/**
 * Envía lo pendiente. Una sola ejecución a la vez; las llamadas concurrentes esperan la misma.
 * 0.4.1: si llega un pedido durante un envío (p. ej. la posición final al salir de un video),
 * al terminar se hace una pasada más en lugar de esperar al ciclo siguiente.
 */
export function flushOutbox(token: string): Promise<ProcessResult | null> {
  if (flushing) {
    flushAgain = true;
    return flushing;
  }
  flushing = (async () => {
    const userId = await getSessionUserId();
    if (!userId) return null;
    const bound: Record<string, OutboxHandler> = {};
    for (const [type, handler] of Object.entries(handlers)) {
      bound[type] = (event, context) => handler(event, { ...context, token });
    }
    try {
      return await processQueue(sqliteOutboxStore, userId, Date.now(), bound, classifyOutboxError, (reason) =>
        reason instanceof Error ? reason.message : 'Error desconocido',
      );
    } finally {
      notify();
    }
  })().finally(() => {
    flushing = null;
    if (flushAgain) {
      flushAgain = false;
      void flushOutbox(token).catch(() => undefined);
    }
  });
  return flushing;
}

export async function listOutbox(): Promise<{ pending: OutboxEvent[]; failed: OutboxEvent[] }> {
  const userId = await getSessionUserId();
  if (!userId) return { pending: [], failed: [] };
  return {
    pending: await pendingEvents(sqliteOutboxStore, userId),
    failed: await failedEvents(sqliteOutboxStore, userId),
  };
}

/** El estudiante descarta un evento fallido después de verlo. */
export async function dismissOutboxEvent(id: string): Promise<void> {
  await sqliteOutboxStore.remove(id);
  try {
    deleteEventFiles(id);
  } catch {
    // Sin adjuntos.
  }
  notify();
}
