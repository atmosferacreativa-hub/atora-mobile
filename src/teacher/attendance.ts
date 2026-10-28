/**
 * 1.3.0 (plugin 6.40.0): asistencia presencial. Módulo puro, para Jest.
 *
 * Tomar lista en el aula sin señal: las marcas se guardan en la cola del teléfono con la hora en que se tomaron y
 * salen al volver la conexión. El servidor se queda con la más reciente de cada estudiante.
 */

export const ATTENDANCE_SAVE = 'attendance.save';

export const STATUSES = ['presente', 'tarde', 'ausente', 'justificado'] as const;
export type AttendanceStatus = (typeof STATUSES)[number];

export type RosterStudent = { id: number; name: string; status: AttendanceStatus | null; note: string; marked_at: string | null };
export type AttendanceSession = { id: number; course_id: number; lesson_id: number; date: string; starts_at: string | null; title: string };
export type AttendanceRoster = {
  session: AttendanceSession;
  students: RosterStudent[];
  today?: string;
  site_timezone?: string;
  in_person_lessons?: { id: number; title: string; date: string | null }[];
  recent?: (AttendanceSession & { counts: Record<AttendanceStatus, number> })[];
};

export type AttendanceMark = { student_id: number; status: AttendanceStatus; note: string; marked_at: string };
export type AttendancePayload = { courseId: number; lessonId: number; date: string; marks: AttendanceMark[] };

/** Edición local: estudiante → estado y nota (lo que el docente tocó y aún no se guardó). */
export type LocalMarks = Record<number, { status: AttendanceStatus; note: string }>;

/** «Todos presentes»: marca presentes a quienes no tienen marca (ni en el servidor ni en el teléfono). */
export function markAllPresent(students: RosterStudent[], local: LocalMarks): LocalMarks {
  const next: LocalMarks = { ...local };
  for (const student of students) {
    if (!next[student.id] && !student.status) next[student.id] = { status: 'presente', note: '' };
  }
  return next;
}

/** Marcas a enviar: solo lo que cambió respecto de lo que ya tiene el servidor. */
export function buildMarks(students: RosterStudent[], local: LocalMarks, now: string): AttendanceMark[] {
  const marks: AttendanceMark[] = [];
  for (const student of students) {
    const edit = local[student.id];
    if (!edit) continue;
    const note = edit.status === 'tarde' || edit.status === 'justificado' ? edit.note.trim().slice(0, 255) : '';
    if (student.status === edit.status && (student.note || '') === note) continue;
    marks.push({ student_id: student.id, status: edit.status, note, marked_at: now });
  }
  return marks;
}

/** Lista con lo pendiente en la cola encima (para ver lo tomado sin conexión). */
export function withPending(roster: AttendanceRoster, pending: AttendancePayload[]): RosterStudent[] {
  const latest = new Map<number, AttendanceMark>();
  for (const payload of pending) {
    if (payload.date !== roster.session.date || payload.lessonId !== roster.session.lesson_id) continue;
    for (const mark of payload.marks) {
      const current = latest.get(mark.student_id);
      if (!current || current.marked_at <= mark.marked_at) latest.set(mark.student_id, mark);
    }
  }
  return roster.students.map((student) => {
    const mark = latest.get(student.id);
    if (!mark) return student;
    if (student.marked_at && student.marked_at > mark.marked_at) return student;
    return { ...student, status: mark.status, note: mark.note, marked_at: mark.marked_at };
  });
}

export function counts(students: { status: AttendanceStatus | null }[]): Record<AttendanceStatus | 'sin_marcar', number> {
  const out = { presente: 0, tarde: 0, ausente: 0, justificado: 0, sin_marcar: 0 };
  for (const student of students) out[student.status ?? 'sin_marcar'] += 1;
  return out;
}

export function attendanceDedupeKey(eventId: string): string {
  return `attendance:${eventId}`;
}
