/**
 * Notificación al teléfono → pantalla (0.6.0). Módulo puro, para Jest.
 *
 * El servidor manda solo ids (nunca el texto): `type` (message/notice),
 * `thread_id`, `message_id`, `kind` y `link` (lección, tarea, quiz o curso).
 */
import type { InternalLink } from '../types';

export type PushData = {
  type?: string;
  category?: string;
  thread_id?: number | string;
  message_id?: number | string;
  kind?: string;
  link?: InternalLink | null;
};

export type Destination =
  | { tab: 'Messages'; screen: 'Thread'; params: { threadId: number } }
  | { tab: 'Courses'; screen: 'Assignment' | 'Quiz' | 'Lesson'; params: { lessonId: number } }
  | { tab: 'Courses'; screen: 'Course'; params: { courseId: number } }
  | { tab: 'Messages'; screen: 'Root'; params: undefined };

const num = (value: unknown): number => {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export function destinationFor(data: PushData | null | undefined): Destination {
  const threadId = num(data?.thread_id);
  // Un mensaje de conversación abre su hilo.
  if (data?.type === 'message' && threadId) return { tab: 'Messages', screen: 'Thread', params: { threadId } };
  // Un aviso con enlace abre lo que anuncia (nota → tarea, lección publicada → lección…).
  const link = data?.link;
  if (link && num(link.id)) {
    if (link.type === 'assignment') return { tab: 'Courses', screen: 'Assignment', params: { lessonId: num(link.id) } };
    if (link.type === 'quiz') return { tab: 'Courses', screen: 'Quiz', params: { lessonId: num(link.id) } };
    if (link.type === 'lesson') return { tab: 'Courses', screen: 'Lesson', params: { lessonId: num(link.id) } };
    if (link.type === 'course') return { tab: 'Courses', screen: 'Course', params: { courseId: num(link.id) } };
  }
  // Sin enlace: el hilo de Avisos.
  if (threadId) return { tab: 'Messages', screen: 'Thread', params: { threadId } };
  return { tab: 'Messages', screen: 'Root', params: undefined };
}
