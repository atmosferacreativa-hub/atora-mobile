import { emptyIndex, planSync, type LocalIndex, type SyncItem, type SyncPage } from '../plan';

const page = (items: SyncItem[], extra: Partial<SyncPage> = {}): SyncPage => ({
  items,
  has_more: false,
  next_cursor: 'c',
  full: false,
  reset: false,
  enrolled_course_ids: [3],
  ...extra,
});
const course = (id: number, revision: number, removed = false): SyncItem => ({ type: 'course', id, course_id: id, revision, removed });
const lesson = (id: number, revision: number, courseId = 3, removed = false): SyncItem => ({ type: 'lesson', id, course_id: courseId, revision, removed });

const synced = (): LocalIndex => ({
  courses: { 3: 2 },
  lessons: { 10: { courseId: 3, revision: 1 }, 11: { courseId: 3, revision: 4 } },
});

describe('planSync', () => {
  it('primera sincronización: trae todo lo listado', () => {
    const plan = planSync(emptyIndex(), [page([course(3, 2), lesson(10, 1), lesson(11, 4)], { full: true })]);
    expect(plan.fetchCourses).toEqual([3]);
    expect(plan.newCourses).toEqual([3]);
    expect(plan.fetchLessons).toEqual([10, 11]);
    expect(plan.index).toEqual(synced());
  });

  it('cambio: solo pide la lección cuya revisión cambió', () => {
    const plan = planSync(synced(), [page([lesson(11, 5)])]);
    expect(plan.fetchLessons).toEqual([11]);
    expect(plan.fetchCourses).toEqual([]);
    expect(plan.removeLessons).toEqual([]);
    expect(plan.index.lessons[11]).toEqual({ courseId: 3, revision: 5 });
  });

  it('alta: una lección nueva se pide', () => {
    const plan = planSync(synced(), [page([lesson(12, 1)])]);
    expect(plan.fetchLessons).toEqual([12]);
  });

  it('baja: lección despublicada o borrada se elimina', () => {
    const plan = planSync(synced(), [page([lesson(10, 2, 3, true)])]);
    expect(plan.removeLessons).toEqual([10]);
    expect(plan.index.lessons[10]).toBeUndefined();
  });

  it('matrícula terminada: se borra el curso y todas sus lecciones', () => {
    const plan = planSync(synced(), [page([{ type: 'enrollment', id: 3, course_id: 3, active: false }], { enrolled_course_ids: [] })]);
    expect(plan.removeCourses).toEqual([3]);
    expect(plan.removeLessons.sort()).toEqual([10, 11]);
    expect(plan.index).toEqual(emptyIndex());
  });

  it('matrícula que sale de la lista vigente sin evento (caducidad): también se borra', () => {
    const plan = planSync(synced(), [page([], { enrolled_course_ids: [] })]);
    expect(plan.removeCourses).toEqual([3]);
  });

  it('matrícula nueva: el curso se trae completo con sus lecciones', () => {
    const plan = planSync(synced(), [page([], { enrolled_course_ids: [3, 8] })]);
    expect(plan.newCourses).toEqual([8]);
    expect(plan.fetchCourses).toEqual([8]);
    expect(plan.index.courses[8]).toBe(0);
  });

  it('estado completo (reset): lo que el servidor ya no lista se borra', () => {
    const plan = planSync(synced(), [page([course(3, 2), lesson(11, 4)], { full: true, reset: true })]);
    expect(plan.removeLessons).toEqual([10]);
    expect(plan.fetchLessons).toEqual([]);
  });

  it('varias páginas se aplican en orden', () => {
    const plan = planSync(synced(), [
      page([lesson(11, 5)], { has_more: true }),
      page([lesson(11, 6), lesson(10, 2, 3, true)]),
    ]);
    expect(plan.fetchLessons).toEqual([11]);
    expect(plan.index.lessons[11]?.revision).toBe(6);
    expect(plan.removeLessons).toEqual([10]);
  });

  it('estado completo cortado a mitad: no borra nada y guarda lo visto', () => {
    const local: LocalIndex = { courses: { 3: 2, 8: 1 }, lessons: { 10: { courseId: 3, revision: 1 }, 20: { courseId: 8, revision: 1 } } };
    const cut = planSync(local, [page([course(3, 2), lesson(10, 1)], { full: true, has_more: true, enrolled_course_ids: [3] })]);
    expect(cut.removeCourses).toEqual([]);
    expect(cut.removeLessons).toEqual([]);
    expect(cut.fullCarry).toEqual({ courses: [3], lessons: [10] });

    // Ejecución siguiente: continúa el listado y termina; solo se borra lo que de verdad no está.
    const done = planSync(cut.index, [page([course(8, 1)], { has_more: false, enrolled_course_ids: [3, 8] })], cut.fullCarry);
    expect(done.removeCourses).toEqual([]);
    expect(done.removeLessons).toEqual([20]);
    expect(done.fullCarry).toBeNull();
  });

  it('incremental cortado: tampoco poda por matrículas hasta la última página', () => {
    const plan = planSync(synced(), [page([], { has_more: true, enrolled_course_ids: [] })]);
    expect(plan.removeCourses).toEqual([]);
    expect(plan.fullCarry).toBeNull();
  });
});
