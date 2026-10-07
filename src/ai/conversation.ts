import { locale, t } from '../i18n/core';
/**
 * Asistente del estudiante (0.9.0, plugin 6.32.0). Módulo puro, para Jest.
 *
 * La conversación vive solo en la memoria del teléfono durante la sesión: no
 * se guarda en disco ni en el servidor, y se borra al cerrar sesión. Al
 * servidor se mandan como contexto los últimos turnos (máximo 6).
 */
export type Turn = { role: 'user' | 'assistant'; content: string };

export const HISTORY_LIMIT = 6;

const conversations = new Map<number, Turn[]>();

export function getConversation(lessonId: number): Turn[] {
  return conversations.get(lessonId) ?? [];
}

export function appendTurn(lessonId: number, turn: Turn): Turn[] {
  const next = [...getConversation(lessonId), turn];
  conversations.set(lessonId, next);
  return next;
}

/** Al cerrar sesión: no queda nada de lo conversado. */
export function clearConversations(): void {
  conversations.clear();
}

/** Lo que se manda como `history`: los últimos turnos antes de la pregunta nueva. */
export function historyFor(turns: Turn[]): Turn[] {
  return turns.slice(-HISTORY_LIMIT);
}

/** Mensaje del límite diario o del tope mensual (429), con la hora de reinicio. */
export function limitMessage(serverMessage: string, resetAt: unknown, now = new Date()): string {
  if (/se reinicia|resets/i.test(serverMessage)) return serverMessage;
  if (typeof resetAt !== 'string' || Number.isNaN(Date.parse(resetAt))) return serverMessage;
  const reset = new Date(resetAt);
  const sameDay = reset.toDateString() === now.toDateString();
  const time = reset.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const when = sameDay ? t('hoy a las {time}', { time }) : t('el {date} a las {time}', { date: reset.toLocaleDateString(locale(), { day: 'numeric', month: 'long' }), time });
  return t('{message} Se reinicia {when}.', { message: serverMessage, when });
}

export const aiDisclaimer = (): string => t('Las respuestas las genera una IA y pueden contener errores. No compartas datos personales.');
export const offlineMessage = (): string => t('Necesitas conexión para usar el asistente');
