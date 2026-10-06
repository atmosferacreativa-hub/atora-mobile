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

/** 0.8.0: entrega para calificar (`GET /teacher/submissions/{id}`). */
export type SubmissionFileRef = { id: number; filename: string; mime_type: string; bytes: number; url: string | null; expires_at: string };
export type SubmissionAttempt = {
  attempt: number;
  source: 'web' | 'mobile' | string;
  server_received_at: string | null;
  client_submitted_at: string | null;
  is_late: boolean;
  body_text: string;
  files: SubmissionFileRef[];
};
export type RubricLevel = { label: string; points: number; descriptor: string };
export type RubricCriterion = {
  index: number;
  name: string;
  description: string;
  max_points: number;
  weight: number;
  levels: RubricLevel[];
  bands: { min: number; max: number; label: string; active_points: number | null; between: string; below: string }[];
  score: number | null;
  level: string | null;
  feedback: string;
};
export type SubmissionDetail = {
  id: number;
  revision: number;
  student: Person;
  course: Named;
  lesson: Named;
  status: string;
  grade: number | null;
  feedback: string;
  graded_attempt: number;
  attempts: SubmissionAttempt[];
  rubric: { id: number; title: string; total_points: number; criteria: RubricCriterion[] } | null;
  group: { id: number; name: string; members: Person[]; submitted_by: Person | null } | null;
  moderated: boolean;
};

export type GradeRequest = {
  scores: { index: number; score: number | null; feedback: string }[];
  feedback: string;
  grade: number | null;
  publish: boolean;
  attempt: number;
  expected_revision: number;
  client_event_id: string;
};

export type GradeOutcome =
  | { kind: 'saved'; submission: SubmissionDetail; replayed: boolean }
  | { kind: 'conflict'; message: string; submission: SubmissionDetail };
