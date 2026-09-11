export type CourseSummary = {
  id: number;
  title: string;
  progress: number;
  nextLesson?: string;
};

export type StudentHome = {
  displayName: string;
  pendingActivities: number;
  courses: CourseSummary[];
};

export type AppSection = 'home' | 'courses' | 'grades' | 'profile';
