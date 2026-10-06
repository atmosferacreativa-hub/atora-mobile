import { ApiError } from './client';
import { authenticatedRequest } from './authenticated';
import { cachedRequest, type Synced } from './cached';
import { enqueueEvent, listOutbox, newEventId, registerOutboxHandler, OutboxDefinitiveError } from '../offline/outbox/runtime';
import { ANNOUNCEMENT_SEND, announcementDedupeKey, cleanAnnouncement, type AnnouncementPayload } from '../teacher/announcements';
import * as FileSystem from 'expo-file-system/legacy';
import { refreshAccessToken } from './session';
import type { GradeOutcome, GradeRequest, QueuePage, StudentFile, StudentsPage, SubmissionDetail, SubmissionFileRef, TeacherCourse, TeacherToday } from '../teacher/types';

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

// ── 0.8.0: calificar ─────────────────────────────────────────────────────

const countListeners = new Set<(count: number) => void>();

/** Contador de la pestaña Calificar (entregas por calificar). */
export function subscribeQueueCount(listener: (count: number) => void): () => void {
  countListeners.add(listener);
  return () => countListeners.delete(listener);
}

export function emitQueueCount(count: number): void {
  countListeners.forEach((listener) => {
    try {
      listener(count);
    } catch {
      // Pantalla desmontada.
    }
  });
}

/** Calificar exige conexión: el detalle no se guarda sin conexión. */
export async function fetchSubmissionDetail(token: string, submissionId: number): Promise<SubmissionDetail> {
  const { submission } = await authenticatedRequest<{ submission: SubmissionDetail }>(`teacher/submissions/${submissionId}`, { token });
  return submission;
}

/**
 * Guarda por el mismo servicio que SpeedGrader. Si otro docente guardó después
 * de la revisión que vio este, el servidor no pisa nada y devuelve su versión.
 */
export async function gradeSubmission(token: string, submissionId: number, request: GradeRequest): Promise<GradeOutcome> {
  try {
    const data = await authenticatedRequest<{ submission: SubmissionDetail; replayed: boolean }>(`teacher/submissions/${submissionId}/grade`, {
      method: 'POST',
      token,
      body: JSON.stringify(request),
    });
    return { kind: 'saved', submission: data.submission, replayed: data.replayed };
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 409) {
      const current = (reason.data ?? {}) as { submission?: SubmissionDetail };
      if (current.submission) return { kind: 'conflict', message: reason.message, submission: current.submission };
    }
    throw reason;
  }
}

const FILES_DIR = `${FileSystem.cacheDirectory ?? ''}grading-files/`;

/** Descarga un archivo de la entrega (enlace firmado y temporal + token del docente) para verlo. */
export async function downloadSubmissionFile(token: string, submissionId: number, file: SubmissionFileRef): Promise<string> {
  if (!file.url) throw new Error('Este archivo no se puede abrir.');
  await FileSystem.makeDirectoryAsync(FILES_DIR, { intermediates: true });
  const safe = file.filename.replace(/[^A-Za-z0-9._-]+/g, '_') || `archivo-${file.id}`;
  const destination = `${FILES_DIR}${submissionId}-${file.id}-${safe}`;
  let result = await FileSystem.downloadAsync(file.url, destination, { headers: { Authorization: `Bearer ${token}` } });
  if (result.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) result = await FileSystem.downloadAsync(file.url, destination, { headers: { Authorization: `Bearer ${refreshed}` } });
  }
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw new Error(result.status === 403 ? 'El enlace venció: vuelve a abrir la entrega.' : 'No se pudo descargar el archivo.');
  }
  return result.uri;
}

/** Al cerrar sesión: los archivos descargados para calificar no quedan en el teléfono. */
export async function purgeGradingFiles(): Promise<void> {
  await FileSystem.deleteAsync(FILES_DIR, { idempotent: true });
}
