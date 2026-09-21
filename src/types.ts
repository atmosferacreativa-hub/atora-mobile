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
  content_html: string;
  content_text: string;
  completed: boolean;
  quiz_available?: boolean;
  resources?: LessonResource[];
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
  course: Pick<CourseSummary, 'id' | 'title' | 'excerpt' | 'thumbnail_url' | 'duration_hours' | 'level' | 'language'>;
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

export type AppSection = 'home' | 'courses' | 'grades' | 'profile';
