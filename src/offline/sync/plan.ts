/**
 * Planificador de sincronización (0.4.0). Módulo puro: sin React Native, para
 * probarlo con Jest. Recibe el índice local (qué revisión tiene la app de cada
 * curso y lección) y las páginas de `GET /sync/changes`, y decide qué traer y
 * qué borrar. El contenido no viaja aquí: la app pide después solo el detalle
 * de lo que cambió.
 */

export type SyncContentItem = {
  type: 'course' | 'lesson';
  id: number;
  course_id: number;
  revision: number;
  removed: boolean;
};

export type SyncEnrollmentItem = { type: 'enrollment'; id: number; course_id: number; active: boolean };

export type SyncItem = SyncContentItem | SyncEnrollmentItem;

export type SyncPage = {
  items: SyncItem[];
  has_more: boolean;
  next_cursor: string;
  full: boolean;
  reset: boolean;
  enrolled_course_ids: number[];
};

export type LocalIndex = {
  /** course_id → revisión guardada. */
  courses: Record<number, number>;
  /** lesson_id → curso y revisión guardada. */
  lessons: Record<number, { courseId: number; revision: number }>;
};

/**
 * Estado completo que quedó a medias (0.4.1): lo visto en ejecuciones
 * anteriores. La poda espera a la última página; mientras tanto se guarda esto
 * junto con el cursor de continuación que dio el servidor.
 */
export type FullCarry = { courses: number[]; lessons: number[] };

export type SyncPlan = {
  /** Cursos a pedir (detalle y currículo). */
  fetchCourses: number[];
  /** Cursos nuevos para la app: además de su detalle, todas sus lecciones. */
  newCourses: number[];
  fetchLessons: number[];
  removeCourses: number[];
  removeLessons: number[];
  /** Índice resultante si todo lo anterior se aplica. */
  index: LocalIndex;
  /** Estado completo sin terminar: guardar y continuar en la próxima ejecución. null si terminó o no era completo. */
  fullCarry: FullCarry | null;
};

export const emptyIndex = (): LocalIndex => ({ courses: {}, lessons: {} });

export function planSync(current: LocalIndex, pages: SyncPage[], carry: FullCarry | null = null): SyncPlan {
  const index: LocalIndex = { courses: { ...current.courses }, lessons: { ...current.lessons } };
  const fetchCourses = new Set<number>();
  const newCourses = new Set<number>();
  const fetchLessons = new Set<number>();
  const removeCourses = new Set<number>();
  const removeLessons = new Set<number>();

  const dropCourse = (courseId: number) => {
    removeCourses.add(courseId);
    fetchCourses.delete(courseId);
    newCourses.delete(courseId);
    delete index.courses[courseId];
    for (const [id, lesson] of Object.entries(index.lessons)) {
      if (lesson.courseId === courseId) dropLesson(Number(id));
    }
  };
  const dropLesson = (lessonId: number) => {
    removeLessons.add(lessonId);
    fetchLessons.delete(lessonId);
    delete index.lessons[lessonId];
  };
  const addCourse = (courseId: number) => {
    if (index.courses[courseId] === undefined && !removeCourses.has(courseId)) {
      newCourses.add(courseId);
      fetchCourses.add(courseId);
    }
  };

  // Un estado completo puede venir de esta ejecución o continuar uno anterior.
  const full = carry !== null || (pages[0]?.full ?? false);
  const seenCourses = new Set<number>(carry?.courses ?? []);
  const seenLessons = new Set<number>(carry?.lessons ?? []);

  for (const page of pages) {
    for (const item of page.items) {
      if (item.type === 'enrollment') {
        if (item.active) addCourse(item.course_id);
        else dropCourse(item.course_id);
        continue;
      }
      if (item.removed) {
        if (item.type === 'course') dropCourse(item.id);
        else dropLesson(item.id);
        continue;
      }
      if (item.type === 'course') {
        seenCourses.add(item.id);
        removeCourses.delete(item.id);
        if (index.courses[item.id] === undefined) newCourses.add(item.id);
        if (index.courses[item.id] !== item.revision) fetchCourses.add(item.id);
        index.courses[item.id] = item.revision;
      } else {
        seenLessons.add(item.id);
        removeLessons.delete(item.id);
        const known = index.lessons[item.id];
        if (!known || known.revision !== item.revision || known.courseId !== item.course_id) fetchLessons.add(item.id);
        index.lessons[item.id] = { courseId: item.course_id, revision: item.revision };
      }
    }
  }

  // 0.4.1: solo con la última página se sabe qué falta. Si el límite de páginas
  // cortó el listado, no se poda nada (ni por estado completo ni por matrículas).
  const last = pages[pages.length - 1];
  const finished = Boolean(last) && !last!.has_more;

  // Estado completo: lo que la app tiene y el servidor ya no lista, se borra.
  if (full && finished) {
    for (const id of Object.keys(index.courses).map(Number)) {
      if (!seenCourses.has(id)) dropCourse(id);
    }
    for (const id of Object.keys(index.lessons).map(Number)) {
      if (!seenLessons.has(id)) dropLesson(id);
    }
  }

  // Matrículas vigentes: cubre caducidades y matrículas que no generan evento.
  if (last && finished) {
    const enrolled = new Set(last.enrolled_course_ids);
    for (const id of Object.keys(index.courses).map(Number)) {
      if (!enrolled.has(id)) dropCourse(id);
    }
    for (const id of enrolled) addCourse(id);
  }

  // Un curso nuevo aún no tiene revisión conocida: la fija su detalle al llegar.
  for (const id of newCourses) {
    if (index.courses[id] === undefined) index.courses[id] = 0;
  }

  return {
    fetchCourses: [...fetchCourses],
    newCourses: [...newCourses],
    fetchLessons: [...fetchLessons],
    removeCourses: [...removeCourses],
    removeLessons: [...removeLessons],
    index,
    fullCarry: full && !finished ? { courses: [...seenCourses], lessons: [...seenLessons] } : null,
  };
}
