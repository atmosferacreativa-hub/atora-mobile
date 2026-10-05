export type UserProfile = {
  id: number;
  display_name: string;
  email: string;
  avatar_url: string;
  roles: string[];
};

export type CourseSummary = {
  id: number;
  title: string;
  excerpt: string;
  thumbnail_url: string;
  duration_hours: number;
  level: string;
  language: string;
  meta?: {
    learning_outcomes?: string[];
    benefits?: string[];
    requirements?: string[];
    audience?: string[];
    entry_profile?: string[];
    exit_profile?: string[];
  };
  progress: number;
  total_lessons: number;
  completed_lessons: number;
  is_complete: boolean;
  grade: number | null;
  last_activity: string;
};

export type ProgramSummary = {
  id: number;
  title: string;
  excerpt: string;
  thumbnail_url: string;
  subtitle?: string;
  duration?: string;
  difficulty?: string;
  modality?: string;
  meta?: {
    learning_outcomes?: string[];
    entry_profile?: string[];
    exit_profile?: string[];
    methodology?: string;
    competencies?: string[];
    evidence?: string;
    evaluation_criteria?: string;
    certification?: string;
  };
};

export type ProgramDetail = {
  program: ProgramSummary;
  courses: CourseSummary[];
};

export type LessonSummary = {
  id: number;
  course_id: number;
  title: string;
  type: string;
  duration_min: number;
  section: string;
  completed: boolean;
  /** 6.27.1+ */
  has_video?: boolean;
  video_thumbnail_url?: string;
  /** 6.28.2+ */
  video_count?: number;
};

/** 6.28.2+: un video de la lección (`GET /lessons/{id}` → `videos[]`). */
export type LessonVideo = {
  key: string;
  title: string;
  description: string;
  source: string;
  url: string;
  embed_url: string;
  provider: 'google_drive' | 'youtube' | 'vimeo' | 'direct';
  thumbnail_url: string;
  downloadable: boolean;
  bytes: number | null;
  resume_position_seconds: number;
};

export type LessonDetail = {
  id: number;
  course_id: number;
  title: string;
  type: string;
  duration_min: number;
  video_url: string;
  video_embed_url?: string;
  video_provider?: 'direct' | 'google_drive' | '';
  /** 6.27.1+: manual, YouTube, Vimeo, destacada de la lección o portada del curso. */
  video_thumbnail_url?: string;
  content_html: string;
  content_text: string;
  completed: boolean;
  quiz_available?: boolean;
  assignment_available?: boolean;
  resources?: LessonResource[];
  /** 6.28.0+ */
  revision?: number;
  video_downloadable?: boolean;
  video_bytes?: number | null;
  resume_position_seconds?: number;
  /** 6.28.2+: todos los videos, en el orden del editor. */
  videos?: LessonVideo[];
};

export type LessonResource = {
  type: string;
  title: string;
  description?: string;
  url: string;
  download_url?: string;
  file_id?: number;
  mime?: string;
  thumb_url?: string;
  /** 6.28.0+: solo material de la propia academia. */
  downloadable?: boolean;
  bytes?: number | null;
  updated_at?: string | null;
};

export type QuizAnswer = string | string[];

export type QuizQuestion = {
  id: number;
  type: 'single' | 'multiple' | 'text' | 'textarea' | 'true_false' | 'number';
  question: string;
  options: string[];
  weight: number;
};

export type QuizPayload = {
  lesson_id: number;
  token: string;
  questions: QuizQuestion[];
  can_submit: boolean;
  remaining_seconds: number;
  attempts: number;
  best_score: number | null;
  retry_context: Record<string, unknown>;
};

export type QuizResult = {
  score: number;
  best_score: number;
  attempt: number;
  student_message: string;
  can_retry: boolean;
};

export type CourseDetail = {
  course: Pick<CourseSummary, 'id' | 'title' | 'excerpt' | 'thumbnail_url' | 'duration_hours' | 'level' | 'language'> & { revision?: number };
  progress: {
    total_lessons: number;
    completed_lessons: number;
    progress_pct: number;
    is_complete: boolean;
  };
  curriculum: LessonSummary[];
};

export type StudentHome = {
  user: UserProfile;
  pending_activities: number;
  courses: CourseSummary[];
  generated_at: string;
};

export type MobileSession = {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_expires_in: number;
  session_id: string;
};

export type LoginResponse = {
  session: MobileSession;
  user: UserProfile;
};


export type ServerCapabilities = {
  assignments?: boolean;
  /** 6.28.0+ */
  sync_changes?: boolean;
  playback_position?: boolean;
  resource_downloads?: boolean;
  /** 6.28.2+ */
  multi_video?: boolean;
  /** 6.29.0+ */
  grades?: boolean;
  certificates?: boolean;
  /** 6.30.0+ */
  messages?: boolean;
  agenda?: boolean;
  today?: boolean;
  push_notifications?: boolean;
};

export type AssignmentInfo = {
  lesson_id: number;
  course_id: number;
  title: string;
  instructions_html: string;
  /** UTC, `Y-m-d H:i:s`. */
  due_at: string | null;
  allow_resubmission: boolean;
  /** null = sin límite. */
  attempts_allowed: number | null;
  attempts_used: number;
  group_mode: boolean;
  can_submit: boolean;
  accepted_files: { extensions: string[]; mime_types: string[]; max_bytes: number; max_files: number };
};

export type AssignmentSubmission = {
  id: number;
  lesson_id: number;
  attempt: number;
  status: string;
  body_text: string;
  files: { filename: string; mime_type: string; bytes: number }[];
  client_submitted_at: string | null;
  server_received_at: string;
  due_at: string | null;
  is_late: boolean;
  grade?: number | null;
  feedback?: string | null;
  review_status?: string;
  /** 6.29.0+: rúbrica por criterio, solo con la nota liberada. */
  rubric?: SubmissionRubric | null;
  /** 6.29.0+: entregada y en revisión (nota aún no liberada). */
  in_review?: boolean;
};

export type SubmissionRubric = {
  /** `level` desde 6.29.2: nivel alcanzado (vacío si el puntaje no coincide con un nivel). */
  rows: { name: string; competency: string; score: number; max: number; level?: string; feedback: string }[];
  strengths: string[];
  reinforce: string[];
  recommendation: string;
};

export type AssignmentResponse = { assignment: AssignmentInfo; submissions: AssignmentSubmission[] };

/** 6.29.0+: `GET /grades`, `GET /courses/{id}/grades`. Solo notas liberadas. */
export type AcademicStatus = 'not_started' | 'in_progress' | 'at_risk' | 'approved' | 'not_approved';

export type CourseGrade = {
  course_id: number;
  title: string;
  final_grade: number | null;
  passing_grade: number;
  progress: number;
  status: AcademicStatus;
  /** 6.29.1+ */
  graded_count?: number;
  last_graded_at?: string | null;
};

export type ProgramGrade = { wp_program_id: number; title: string; courses: number; final_grade: number | null; progress: number };

export type GradesSummary = { courses: CourseGrade[]; programs: ProgramGrade[]; generated_at: string };

export type ActivityGrade = {
  lesson_id: number;
  title: string;
  kind: 'assignment' | 'quiz' | 'activity';
  activity_type: string;
  weight_label: string;
  weight: number | null;
  grade: number | null;
  status: 'graded' | 'in_review' | 'needs_revision' | 'completed' | 'pending';
  has_feedback: boolean;
  graded_at: string | null;
};

export type CourseGradesDetail = { course: CourseGrade; activities: ActivityGrade[] };

export type CertificateItem = {
  type: 'course' | 'program';
  id: number;
  course_id: number | null;
  title: string;
  status: 'issued' | 'available' | 'revoked';
  issued_at: string;
  certificate_code: string;
  download_url: string;
  download_expires_at: string | null;
};

/** 6.30.0+: buzón (mensajes y avisos). */
export type InternalLink = { type: 'lesson' | 'assignment' | 'quiz' | 'course'; id: number; course_id: number };

export type InboxMessage = {
  id: number;
  thread_id: number;
  kind: string;
  author: { id: number; name: string } | null;
  mine: boolean;
  title: string;
  body: string;
  link: InternalLink | null;
  client_event_id: string | null;
  created_at: string | null;
  read: boolean;
};

export type MessageThread = {
  id: number;
  type: 'system' | 'direct' | 'course';
  title: string;
  course_id: number;
  unread: number;
  muted: boolean;
  can_reply: boolean;
  last_message_at: string | null;
  last_message: { id: number; kind: string; preview: string; mine: boolean } | null;
};

export type ThreadsResponse = { avisos: MessageThread; threads: MessageThread[]; next_cursor: string | null; unread: number };
export type ThreadResponse = { thread: MessageThread; messages: InboxMessage[]; next_before: number | null };
export type MessageRecipient = { id: number; name: string; courses: { id: number; title: string }[] };

/** 6.30.0+: agenda y Hoy. */
export type AgendaItem = {
  type: 'event' | 'assignment_due' | 'quiz_due' | 'live_class';
  title: string;
  starts_at: string;
  ends_at: string | null;
  course: { id: number; title: string } | null;
  link: InternalLink | null;
  done: boolean;
};

export type AgendaResponse = { from: string; to: string; timezone: string; items: AgendaItem[]; generated_at: string };

export type TodayStudent = {
  role: 'student';
  continue: { course: { id: number; title: string }; lesson: { id: number; title: string }; progress: number } | null;
  upcoming: AgendaItem[];
  overdue: AgendaItem[];
  unread_messages: number;
  new_grades: { course_id: number; title: string; graded_count: number; last_graded_at: string }[];
  generated_at: string;
};

export type TodayStaff = { role: 'staff'; items: { source: string; title: string; count: number; urgency: string; url: string }[]; unread_messages: number; generated_at: string };

export type NotificationPreferences = { messages: boolean; notices: boolean; grades: boolean; deadlines: boolean };
