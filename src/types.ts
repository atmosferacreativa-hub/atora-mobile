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
  progress: number;
  total_lessons: number;
  completed_lessons: number;
  is_complete: boolean;
  grade: number | null;
  last_activity: string;
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
