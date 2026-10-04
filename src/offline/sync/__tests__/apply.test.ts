import { applyPlan, SyncAllFailedError, type ApplyDeps } from '../apply';
import { planSync, type LocalIndex, type SyncItem, type SyncPage } from '../plan';

const page = (items: SyncItem[]): SyncPage => ({ items, has_more: false, next_cursor: 'c', full: false, reset: false, enrolled_course_ids: [3] });
const lesson = (id: number, revision: number): SyncItem => ({ type: 'lesson', id, course_id: 3, revision, removed: false });

const local = (): LocalIndex => ({ courses: { 3: 2 }, lessons: { 10: { courseId: 3, revision: 1 }, 11: { courseId: 3, revision: 1 } } });

function deps(failing: Set<number>, calls: number[] = []): ApplyDeps {
  return {
    removeLesson: async () => undefined,
    removeCourse: async () => undefined,
    syncCourse: async () => ({ revision: 2, lessonIds: [10, 11] }),
    syncLesson: async (id) => {
      calls.push(id);
      // Falla la consigna de esta lección: el paso entero cuenta como fallido.
      if (failing.has(id)) throw new Error('fetchAssignment falló');
      return { courseId: 3, revision: 5 };
    },
  };
}

describe('applyPlan', () => {
  it('un fallo de la consigna deja la lección pendiente y la siguiente ejecución la vuelve a pedir', async () => {
    const before = local();
    const plan = planSync(before, [page([lesson(10, 5), lesson(11, 5)])]);
    const first = await applyPlan(plan, before, deps(new Set([10])));

    expect(first.failed).toBe(1);
    expect(first.index.lessons[10]).toEqual({ courseId: 3, revision: 1 });
    expect(first.index.lessons[11]).toEqual({ courseId: 3, revision: 5 });

    // El cursor avanzó: el servidor ya no lista nada nuevo, pero la revisión local difiere.
    const calls: number[] = [];
    const again = planSync(first.index, [page([lesson(10, 5)])]);
    expect(again.fetchLessons).toEqual([10]);
    const second = await applyPlan(again, first.index, deps(new Set(), calls));
    expect(calls).toEqual([10]);
    expect(second.index.lessons[10]).toEqual({ courseId: 3, revision: 5 });
  });

  it('si fallan todos los pedidos, lanza y no hay índice que guardar', async () => {
    const before = local();
    const plan = planSync(before, [page([lesson(10, 5), lesson(11, 5)])]);
    const offline = { ...deps(new Set([10, 11])), syncCourse: async () => { throw new Error('sin red'); } };
    await expect(applyPlan(plan, before, offline)).rejects.toBeInstanceOf(SyncAllFailedError);
  });

  it('un curso que falla conserva su revisión anterior', async () => {
    const before = local();
    const plan = planSync(before, [page([{ type: 'course', id: 3, course_id: 3, revision: 9, removed: false }, lesson(11, 5)])]);
    const result = await applyPlan(plan, before, {
      ...deps(new Set()),
      syncCourse: async () => { throw new Error('sin red'); },
    });
    expect(result.index.courses[3]).toBe(2);
    expect(result.index.lessons[11]?.revision).toBe(5);
  });
});
