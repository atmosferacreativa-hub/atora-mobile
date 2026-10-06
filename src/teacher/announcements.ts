/**
 * Aviso del docente a un curso (0.7.0). Módulo puro, para Jest.
 *
 * Enviar encola un evento `announcement.send` con su client_event_id (el id
 * del evento): sin conexión queda pendiente y sale al volver, una sola vez.
 */
export const ANNOUNCEMENT_SEND = 'announcement.send';

export type AnnouncementPayload = { courseId: number; sectionId?: number; title: string; body: string; createdAt: string };

export function announcementDedupeKey(eventId: string): string {
  return `announcement:${eventId}`;
}

/** Título y cuerpo limpios; sin cuerpo no se envía. */
export function cleanAnnouncement(title: string, body: string): { title: string; body: string } | null {
  const text = body.trim();
  if (!text) return null;
  return { title: title.trim().slice(0, 120), body: text.slice(0, 4000) };
}

/** Pendientes de un curso, del más nuevo al más viejo (para mostrarlos en la pantalla del curso). */
export function pendingFor<T extends { payload: AnnouncementPayload }>(events: T[], courseId: number): T[] {
  return events.filter((event) => event.payload.courseId === courseId).sort((a, b) => b.payload.createdAt.localeCompare(a.payload.createdAt));
}
