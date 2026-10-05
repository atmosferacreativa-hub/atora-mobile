/**
 * Mensajes salientes (0.6.0). Módulo puro, para Jest.
 *
 * Escribir encola un evento `message.send` en la cola de envíos, con su
 * `client_event_id` (el id del evento): el servidor no lo duplica aunque se
 * reintente. Mientras no se confirma, el hilo lo muestra "pendiente"; si el
 * servidor lo rechaza (4xx), "no se envió". Cuando el servidor lo devuelve
 * (mismo client_event_id), la copia local desaparece.
 */
import type { InboxMessage } from '../types';

export const MESSAGE_SEND = 'message.send';

export type MessagePayload = {
  /** Hilo existente, o destinatario (docente) para empezar una conversación. */
  threadId?: number;
  recipientId?: number;
  courseId?: number;
  body: string;
  createdAt: string;
};

export type OutgoingEvent = { id: string; status: 'pending' | 'failed'; lastError: string; payload: MessagePayload };

export type DisplayMessage = InboxMessage & { state: 'sent' | 'pending' | 'failed'; error?: string };

export function messageDedupeKey(eventId: string): string {
  return `message:${eventId}`;
}

/** El cuerpo que se envía: sin espacios sobrantes; vacío no se envía. */
export function cleanBody(body: string): string | null {
  const text = body.replace(/\s+$/g, '').replace(/^\s+/g, '');
  return text.length ? text.slice(0, 4000) : null;
}

/** ¿Este evento pendiente pertenece a este hilo? */
export function belongsTo(event: OutgoingEvent, threadId: number, recipientId?: number): boolean {
  if (event.payload.threadId) return event.payload.threadId === threadId;
  return recipientId !== undefined && event.payload.recipientId === recipientId;
}

/**
 * Lista para mostrar: lo del servidor (del más nuevo al más viejo) más lo
 * pendiente arriba. Un pendiente cuyo client_event_id ya llegó del servidor
 * no se repite (idempotencia visible).
 */
export function mergeOutgoing(server: InboxMessage[], outgoing: OutgoingEvent[], threadId: number, recipientId?: number): DisplayMessage[] {
  const confirmed = new Set(server.map((message) => message.client_event_id).filter(Boolean) as string[]);
  const local: DisplayMessage[] = outgoing
    .filter((event) => belongsTo(event, threadId, recipientId) && !confirmed.has(event.id))
    .sort((a, b) => b.payload.createdAt.localeCompare(a.payload.createdAt))
    .map((event) => ({
      id: -1,
      thread_id: threadId,
      kind: 'message',
      author: null,
      mine: true,
      title: '',
      body: event.payload.body,
      link: null,
      client_event_id: event.id,
      created_at: event.payload.createdAt,
      read: true,
      state: event.status === 'failed' ? 'failed' : 'pending',
      ...(event.status === 'failed' ? { error: event.lastError } : {}),
    }));
  return [...local, ...server.map((message) => ({ ...message, state: 'sent' as const }))];
}

/** Al confirmarse: el mensaje del servidor entra a la caché del hilo una sola vez. */
export function addConfirmed(cached: InboxMessage[], confirmed: InboxMessage): InboxMessage[] {
  if (cached.some((message) => message.id === confirmed.id || (confirmed.client_event_id && message.client_event_id === confirmed.client_event_id))) return cached;
  return [confirmed, ...cached];
}
