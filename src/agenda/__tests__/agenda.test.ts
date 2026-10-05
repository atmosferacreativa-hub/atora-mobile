import { addDays, groupByDay, offlineAgenda, rangeFor, weekStart } from '../agenda';
import type { AgendaItem } from '../../types';

const item = (title: string, startsAt: string): AgendaItem => ({
  type: 'assignment_due', title, starts_at: startsAt, ends_at: null, course: { id: 1, title: 'Curso' },
  link: { type: 'assignment', id: 7, course_id: 1 }, done: false,
});
const at = (day: string, hour: number) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, 0, 0).toISOString();
};

describe('agenda', () => {
  it('vista semanal de lunes a domingo', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05');
    expect(rangeFor('week', '2026-10-08')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(rangeFor('day', '2026-10-08')).toEqual({ from: '2026-10-08', to: '2026-10-08' });
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('agrupa por día local con los días vacíos', () => {
    const days = groupByDay([item('B', at('2026-10-06', 18)), item('A', at('2026-10-06', 9))], '2026-10-05', '2026-10-07');
    expect(days.map((d) => [d.day, d.items.map((i) => i.title)])).toEqual([
      ['2026-10-05', []],
      ['2026-10-06', ['A', 'B']],
      ['2026-10-07', []],
    ]);
  });

  it('sin conexión usa lo último sincronizado que cubre el rango, con su fecha', () => {
    const cached = [
      { from: '2026-10-05', to: '2026-10-11', items: [item('Tarea', at('2026-10-06', 18)), item('Fuera', at('2026-10-09', 9))], syncedAt: 200 },
      { from: '2026-10-05', to: '2026-10-11', items: [], syncedAt: 100 },
    ];
    const day = offlineAgenda(cached, '2026-10-06', '2026-10-06');
    expect(day?.syncedAt).toBe(200);
    expect(day?.items.map((i) => i.title)).toEqual(['Tarea']);
    expect(offlineAgenda(cached, '2026-10-12', '2026-10-18')).toBeNull();
  });
});
