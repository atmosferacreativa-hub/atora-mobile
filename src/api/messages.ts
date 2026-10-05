import { ApiError } from './client';
import { authenticatedRequest } from './authenticated';
import { getSessionUserId } from './session';
import { cachedRequest, type Synced } from './cached';
import { cacheGet, cacheSet } from '../offline/localCache';
import { enqueueEvent, listOutbox, newEventId, registerOutboxHandler, OutboxDefinitiveError } from '../offline/outbox/runtime';
import { addConfirmed, cleanBody, MESSAGE_SEND, messageDedupeKey, type MessagePayload, type OutgoingEvent } from '../messages/outgoing';
import type { InboxMessage, MessageRecipient, ThreadResponse, ThreadsResponse } from '../types';

/**
 * Mensajes (0.6.0, plugin 6.30.0). Buzón propio: hilos con no leídos, historial
 * paginado y respuesta. Escribir entra a la cola de envíos con su
 * client_event_id: sin conexión queda "pendiente" y se envía solo al volver,
 * una sola vez. Los hilos ya abiertos se leen sin conexión.
 */
export { MESSAGE_SEND };

const listeners = new Set<(unread: number) => void>();

/** Contador único de no leídos (pestaña Mensajes). */
export function subscribeUnread(listener: (unread: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitUnread(unread: number): void {
  listeners.forEach((listener) => {
    try {
      listener(unread);
    } catch {
      // Pantalla desmontada.
    }
  });
}

export async function fetchThreads(token: string): Promise<Synced<ThreadsResponse>> {
  const result = await cachedRequest<ThreadsResponse>('messages/threads', 'threads', 0, token);
  if (!result.fromCache) emitUnread(result.data.unread);
  return result;
}

/** Historial del hilo (página más reciente; `before` para ir hacia atrás). La primera página queda guardada. */
export async function fetchThread(threadId: number, token: string, before?: number): Promise<Synced<ThreadResponse>> {
  if (before) {
    const data = await authenticatedRequest<ThreadResponse>(`messages/threads/${threadId}?before=${before}`, { token });
    return { data, syncedAt: Date.now(), fromCache: false };
  }
  return cachedRequest<ThreadResponse>(`messages/threads/${threadId}`, 'thread', threadId, token);
}

export async function markThreadRead(threadId: number, token: string, upto?: number): Promise<void> {
  const { unread } = await authenticatedRequest<{ unread: number }>(`messages/threads/${threadId}/read`, {
    method: 'POST',
    token,
    body: JSON.stringify(upto ? { upto } : {}),
  });
  emitUnread(unread);
}

export async function fetchUnreadCount(token: string): Promise<number> {
  const { unread } = await authenticatedRequest<{ unread: number }>('messages/unread-count', { token });
  emitUnread(unread);
  return unread;
}

export async function fetchRecipients(token: string): Promise<MessageRecipient[]> {
  const { recipients } = await authenticatedRequest<{ recipients: MessageRecipient[] }>('messages/recipients', { token });
  return recipients;
}

/** Escribe: entra a la cola (se envía ahora si hay conexión, o al volver). */
export async function sendMessage(target: { threadId?: number; recipientId?: number; courseId?: number }, body: string): Promise<string | null> {
  const text = cleanBody(body);
  if (!text) return null;
  const id = newEventId();
  await enqueueEvent<MessagePayload>({
    id,
    type: MESSAGE_SEND,
    dedupeKey: messageDedupeKey(id),
    payload: { ...target, body: text, createdAt: new Date().toISOString() },
  });
  return id;
}

/** Mensajes en la cola (pendientes o con error) para mostrarlos en su hilo. */
export async function outgoingMessages(): Promise<OutgoingEvent[]> {
  const { pending, failed } = await listOutbox().catch(() => ({ pending: [], failed: [] }));
  return [...pending, ...failed]
    .filter((event) => event.type === MESSAGE_SEND)
    .map((event) => ({ id: event.id, status: event.status, lastError: event.lastError, payload: event.payload as MessagePayload }));
}

/** Hilo creado por un mensaje enviado a un docente (para abrirlo al confirmarse). */
export async function threadForEvent(eventId: string): Promise<number | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const map = (await cacheGet<Record<string, number>>(userId, 'thread', 0).catch(() => null)) ?? {};
  return map[eventId] ?? null;
}

registerOutboxHandler<MessagePayload>(MESSAGE_SEND, async (event, { token }) => {
  const { payload } = event;
  let response: { message: InboxMessage };
  try {
    response = await authenticatedRequest<{ message: InboxMessage }>('messages', {
      method: 'POST',
      token,
      body: JSON.stringify({
        ...(payload.threadId ? { thread_id: payload.threadId } : { recipient_id: payload.recipientId, course_id: payload.courseId }),
        body: payload.body,
        client_event_id: event.id,
      }),
    });
  } catch (reason) {
    // 400/403/404: el servidor no lo aceptará nunca; queda "no se envió" con su motivo.
    if (reason instanceof ApiError && [400, 403, 404].includes(reason.status)) throw new OutboxDefinitiveError(reason.message);
    throw reason;
  }
  const userId = await getSessionUserId();
  if (!userId) return;
  // Entra a la caché del hilo una sola vez (aunque el envío se haya repetido).
  const threadId = response.message.thread_id;
  const cached = await cacheGet<{ data: ThreadResponse; syncedAt: number }>(userId, 'thread', threadId).catch(() => null);
  if (cached) {
    await cacheSet(userId, 'thread', threadId, { ...cached, data: { ...cached.data, messages: addConfirmed(cached.data.messages, response.message) } }).catch(() => undefined);
  }
  if (!payload.threadId) {
    const map = (await cacheGet<Record<string, number>>(userId, 'thread', 0).catch(() => null)) ?? {};
    await cacheSet(userId, 'thread', 0, { ...map, [event.id]: threadId }).catch(() => undefined);
  }
});
