/** API del docente (0.7.0, plugin 6.31.0: `atora-mobile/v1/teacher/*`). */
import type { AgendaItem } from '../types';

export type RiskLevel = 'bajo' | 'medio' | 'alto';
export type Risk = { level: RiskLevel; label: string; reasons: string[] };
export type Person = { id: number; name: string };
export type Named = { id: number; title: string };

export type QueueStatus = 'pending' | 'draft' | 'graded' | 'late';
export type QueueItem = {
  id: number;
  student: Person;
  course: Named;
  lesson: Named;
  status: QueueStatus | string;
  status_label: string;
  is_late: boolean;
  group: boolean;
  submitted_at: string | null;
};

export type TeacherToday = {
  to_grade: { count: number; oldest: QueueItem[] };
  at_risk: { count: number; items: { student: Person; course: Named; risk: Risk }[] };
  today: Omit<AgendaItem, 'done'>[];
  unread_messages: number;
  generated_at: string;
};

export type TeacherCourse = {
  id: number;
  title: string;
  students: number;
  pending_submissions: number;
  sections: { id: number; title: string; students: number }[];
};

export type StudentRow = {
  id: number;
  name: string;
  progress: number;
  final_grade: number | null;
  last_access: string | null;
  risk: Risk;
};

export type StudentsPage = { items: StudentRow[]; page: number; per_page: number; total: number; next_page: number | null };

export type StudentFile = {
  student: Person & { email: string };
  course: Named;
  summary: Omit<StudentRow, 'name'>;
  grades: { title: string; grade: number | null; status: string; kind: string }[];
  submissions: { id: number; lesson: Named; status: string; grade: number | null; submitted_at: string | null }[];
  alerts: { type: string; status: string; severity: number; count: number; updated_at: string | null }[];
  pending: number;
};

export type QueuePage = { items: QueueItem[]; total: number; next_cursor: string | null };
