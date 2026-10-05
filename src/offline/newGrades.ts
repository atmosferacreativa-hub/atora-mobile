/**
 * Aviso de nota nueva (0.5.0). Módulo puro: sin React Native, para Jest.
 *
 * Compara lo que el servidor informa por curso (`graded_count`, `last_graded_at`,
 * solo notas liberadas) con lo último que el estudiante ya vio.
 */
export type SeenGrades = Record<number, { count: number; last: string | null }>;

type CourseMarker = { course_id: number; graded_count?: number; last_graded_at?: string | null };

/** Cursos con alguna calificación que el estudiante todavía no vio. */
export function coursesWithNewGrades(seen: SeenGrades, courses: CourseMarker[]): number[] {
  return courses
    .filter((course) => {
      const count = course.graded_count ?? 0;
      if (count <= 0) return false;
      const before = seen[course.course_id];
      if (!before) return true;
      return count > before.count || (course.last_graded_at ?? '') > (before.last ?? '');
    })
    .map((course) => course.course_id);
}

/** Marca como vistas las notas de esos cursos (o de todos si no se indican). */
export function markSeen(seen: SeenGrades, courses: CourseMarker[], only?: number[]): SeenGrades {
  const next = { ...seen };
  for (const course of courses) {
    if (only && !only.includes(course.course_id)) continue;
    next[course.course_id] = { count: course.graded_count ?? 0, last: course.last_graded_at ?? null };
  }
  return next;
}

/**
 * La primera vez (sin nada visto) no se avisa de lo que ya existía: se toma
 * como punto de partida. Solo lo que llegue después dispara el aviso.
 */
export function baseline(seen: SeenGrades | null, courses: CourseMarker[]): SeenGrades {
  return seen ?? markSeen({}, courses);
}
