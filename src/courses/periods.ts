import type { CourseSummary, CoursePeriod } from '../types';

export type PeriodGroup = { period: CoursePeriod; courses: CourseSummary[] };

/** Activos: sin período o con el período abierto. El servidor ya quitó los de períodos cerrados sin acceso. */
export function isPastCourse(course: CourseSummary): boolean {
  return course.period?.status === 'closed';
}

/**
 * Agrupa los cursos para «Mis cursos» (plugin 6.41.0): los activos arriba, en el orden del servidor; debajo los de
 * períodos cerrados, un grupo por período, del más reciente al más antiguo (fin, luego inicio, luego id).
 */
export function groupCourses(courses: CourseSummary[]): { active: CourseSummary[]; past: PeriodGroup[] } {
  const active: CourseSummary[] = [];
  const byPeriod = new Map<number, PeriodGroup>();
  for (const course of courses) {
    if (!isPastCourse(course) || !course.period) {
      active.push(course);
      continue;
    }
    const group = byPeriod.get(course.period.id) ?? { period: course.period, courses: [] };
    group.courses.push(course);
    byPeriod.set(course.period.id, group);
  }
  const past = [...byPeriod.values()].sort((a, b) => {
    const end = (b.period.ends_on ?? '').localeCompare(a.period.ends_on ?? '');
    if (end !== 0) return end;
    const start = (b.period.starts_on ?? '').localeCompare(a.period.starts_on ?? '');
    return start !== 0 ? start : b.period.id - a.period.id;
  });
  return { active, past };
}
