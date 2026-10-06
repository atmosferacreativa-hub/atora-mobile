import { ApiError } from './client';
import { authenticatedRequest } from './authenticated';
import { cachedRequest, type Synced } from './cached';
import { enqueueEvent, listOutbox, newEventId, registerOutboxHandler, OutboxDefinitiveError } from '../offline/outbox/runtime';
import { ANNOUNCEMENT_SEND, announcementDedupeKey, cleanAnnouncement, type AnnouncementPayload } from '../teacher/announcements';
import type { QueuePage, StudentFile, StudentsPage, TeacherCourse, TeacherToday } from '../teacher/types';

/**
 * Docente (0.7.0, plugin 6.31.0). Lecturas con respaldo sin conexión (lo último
 * sincronizado); el aviso al curso entra a la cola de envíos.
 */
export function fetchTeacherToday(token: string): Promise<Synced<TeacherToday>> {
  return cachedRequest<TeacherToday>('teacher/today', 'teacher', 1, token);
}

export function fetchTeacherCourses(token: string): Promise<Synced<{ items: TeacherCourse[] }>> {
  return cachedRequest<{ items: TeacherCourse[] }>('teacher/courses', 'teacher', 2, token);
}

/** Primera página sin búsqueda: guardada para verla sin conexión. */
export function fetchCourseStudents(token: string, courseId: number, page = 1, search = ''): Promise<Synced<StudentsPage>> {
  const query = `teacher/courses/${courseId}/students?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  if (page === 1 && !search) return cachedRequest<StudentsPage>(query, 'teacher_students', courseId, token);
  return authenticatedRequest<StudentsPage>(query, { token }).then((data) => ({ data, syncedAt: Date.now(), fromCache: false }));
}

export function fetchStudentFile(token: string, studentId: number, courseId: number): Promise<StudentFile> {
  return authenticatedRequest<StudentFile>(`teacher/students/${studentId}?course=${courseId}`, { token });
}

export function fetchQueue(token: string, filters: { status?: string; course?: number; lesson?: number; cursor?: string | null } = {}): Promise<QueuePage> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.course) params.set('course', String(filters.course));
  if (filters.lesson) params.set('lesson', String(filters.lesson));
  if (filters.cursor) params.set('cursor', filters.cursor);
  const query = params.toString();
  return authenticatedRequest<QueuePage>(`teacher/submissions${query ? `?${query}` : ''}`, { token });
}

/** Aviso a un curso o sección: a la cola (sale ahora con conexión, o al volver). */
export async function sendAnnouncement(courseId: number, title: string, body: string, sectionId?: number): Promise<string | null> {
  const clean = cleanAnnouncement(title, body);
  if (!clean) return null;
  const id = newEventId();
  await enqueueEvent<AnnouncementPayload>({
    id,
    type: ANNOUNCEMENT_SEND,
    dedupeKey: announcementDedupeKey(id),
    payload: { courseId, ...(sectionId ? { sectionId } : {}), ...clean, createdAt: new Date().toISOString() },
  });
  return id;
}

export async function pendingAnnouncements(): Promise<{ id: string; status: 'pending' | 'failed'; lastError: string; payload: AnnouncementPayload }[]> {
  const { pending, failed } = await listOutbox().catch(() => ({ pending: [], failed: [] }));
  return [...pending, ...failed]
    .filter((event) => event.type === ANNOUNCEMENT_SEND)
    .map((event) => ({ id: event.id, status: event.status, lastError: event.lastError, payload: event.payload as AnnouncementPayload }));
}

registerOutboxHandler<AnnouncementPayload>(ANNOUNCEMENT_SEND, async (event, { token }) => {
  const { payload } = event;
  try {
    await authenticatedRequest('teacher/announcements', {
      method: 'POST',
      token,
      body: JSON.stringify({
        course_id: payload.courseId,
        ...(payload.sectionId ? { section_id: payload.sectionId } : {}),
        title: payload.title,
        body: payload.body,
        client_event_id: event.id,
      }),
    });
  } catch (reason) {
    // 400/403/404: el servidor no lo aceptará nunca; queda "no se envió" con su motivo.
    if (reason instanceof ApiError && [400, 403, 404].includes(reason.status)) throw new OutboxDefinitiveError(reason.message);
    throw reason;
  }
});
