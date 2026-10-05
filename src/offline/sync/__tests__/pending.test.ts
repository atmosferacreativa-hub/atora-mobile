import { applyPlan, MAX_BLOCKING_ATTEMPTS, retryDelayMs, type ApplyDeps, type PendingItem } from '../apply';
import { planSync, type LocalIndex, type SyncItem, type SyncPage } from '../plan';

/**
 * 0.5.3: reintento de lo que falló aunque el servidor no lo vuelva a listar.
 * El caso real: el cursor ya avanzó, así que la respuesta siguiente llega vacía.
 */
const page = (items: SyncItem[]): SyncPage => ({ items, has_more: false, next_cursor: 'c', full: false, reset: false, enrolled_course_ids: [3] });
const empty = () => page([]);
const lesson = (id: number, revision: number): SyncItem => ({ type: 'lesson', id, course_id: 3, revision, removed: false });
const local = (): LocalIndex => ({ courses: { 3: 2 }, lessons: { 10: { courseId: 3, revision: 1 }, 11: { courseId: 3, revision: 1 } } });

type Behaviour = (id: number, call: number) => 'ok' | 'fail' | 404;

function deps(behaviour: Behaviour, calls: number[], removed: number[] = []): ApplyDeps {
  const count = new Map<number, number>();
  return {
    removeLesson: async (id) => { removed.push(id); },
    removeCourse: async () => undefined,
    syncCourse: async () => ({ revision: 2, lessonIds: [10, 11] }),
    syncLesson: async (id) => {
      calls.push(id);
      const n = (count.get(id) ?? 0) + 1;
      count.set(id, n);
      const outcome = behaviour(id, n);
      if (outcome === 404) throw Object.assign(new Error('No encontrada'), { status: 404 });
      if (outcome === 'fail') throw Object.assign(new Error('Error del servidor'), { status: 500 });
      return { courseId: 3, revision: 5 };
    },
  };
}

/** Una sincronización completa: planificar con lo que llegó y aplicar con los pendientes. */
async function run(index: LocalIndex, pending: PendingItem[], pages: SyncPage[], d: ApplyDeps, now: number) {
  const plan = planSync(index, pages);
  return applyPlan(plan, index, d, pending, now);
}

describe('sync_pending', () => {
  it('una lección falla y la respuesta siguiente llega vacía: se reintenta y se actualiza', async () => {
    const calls: number[] = [];
    const d = deps((id, n) => (id === 10 && n === 1 ? 'fail' : 'ok'), calls);
    const first = await run(local(), [], [page([lesson(10, 5), lesson(11, 5)])], d, 0);
    expect(first.index.lessons[10]).toEqual({ courseId: 3, revision: 1 });
    expect(first.pending).toMatchObject([{ kind: 'lesson', id: 10, targetRevision: 5, attempts: 1 }]);

    calls.length = 0;
    const second = await run(first.index, first.pending, [empty()], d, retryDelayMs(1));
    expect(calls).toEqual([10]);
    expect(second.index.lessons[10]).toEqual({ courseId: 3, revision: 5 });
    expect(second.pending).toEqual([]);
  });

  it('falla dos veces y luego funciona; antes de la espera no se reintenta', async () => {
    const calls: number[] = [];
    const d = deps((id, n) => (id === 10 && n <= 2 ? 'fail' : 'ok'), calls);
    const first = await run(local(), [], [page([lesson(10, 5)])], d, 0);

    calls.length = 0;
    const early = await run(first.index, first.pending, [empty()], d, retryDelayMs(1) - 1);
    expect(calls).toEqual([]);
    expect(early.pending[0]?.attempts).toBe(1);

    const second = await run(early.index, early.pending, [empty()], d, retryDelayMs(1));
    expect(second.pending[0]).toMatchObject({ id: 10, attempts: 2 });
    expect(second.pending[0]!.nextAttemptAt).toBe(retryDelayMs(1) + retryDelayMs(2));

    const third = await run(second.index, second.pending, [empty()], d, second.pending[0]!.nextAttemptAt);
    expect(third.index.lessons[10]?.revision).toBe(5);
    expect(third.pending).toEqual([]);
    expect(calls).toEqual([10, 10]);
  });

  it('pendiente y nueva revisión en la misma respuesta: un solo pedido y la revisión nueva', async () => {
    const calls: number[] = [];
    const pending: PendingItem[] = [{ kind: 'lesson', id: 10, courseId: 3, targetRevision: 5, attempts: 1, lastError: 'x', nextAttemptAt: 0, newCourse: false }];
    const d: ApplyDeps = { ...deps(() => 'fail', calls), syncLesson: async (id) => { calls.push(id); throw Object.assign(new Error('sigue fallando'), { status: 500 }); } };
    const result = await run(local(), pending, [page([lesson(10, 7), lesson(11, 5)])], { ...d, syncLesson: async (id) => { calls.push(id); if (id === 11) return { courseId: 3, revision: 5 }; throw Object.assign(new Error('x'), { status: 500 }); } }, 100);
    expect(calls.filter((id) => id === 10)).toHaveLength(1);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0]).toMatchObject({ id: 10, targetRevision: 7, attempts: 2 });
  });

  it('un 404 en el reintento se trata como baja y se borra localmente', async () => {
    const calls: number[] = [];
    const removed: number[] = [];
    const d = deps((id, n) => (id === 10 ? (n === 1 ? 'fail' : 404) : 'ok'), calls, removed);
    const first = await run(local(), [], [page([lesson(10, 5)])], d, 0);
    const second = await run(first.index, first.pending, [empty()], d, retryDelayMs(1));
    expect(removed).toEqual([10]);
    expect(second.index.lessons[10]).toBeUndefined();
    expect(second.pending).toEqual([]);
  });

  it('tras 10 intentos sigue pendiente pero ya no cuenta como fallo', async () => {
    const calls: number[] = [];
    const d = deps(() => 'fail', calls);
    const pending: PendingItem[] = [{ kind: 'lesson', id: 10, courseId: 3, targetRevision: 5, attempts: MAX_BLOCKING_ATTEMPTS, lastError: 'x', nextAttemptAt: 0, newCourse: false }];
    const result = await run(local(), pending, [empty()], d, 1);
    expect(calls).toEqual([10]);
    expect(result.failed).toBe(0);
    expect(result.pending[0]).toMatchObject({ id: 10, attempts: MAX_BLOCKING_ATTEMPTS + 1 });
  });
});
