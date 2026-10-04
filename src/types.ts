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
};

export type AssignmentResponse = { assignment: AssignmentInfo; submissions: AssignmentSubmission[] };
