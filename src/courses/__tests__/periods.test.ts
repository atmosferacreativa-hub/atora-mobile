import { groupCourses } from '../periods';
import type { CourseSummary, CoursePeriod } from '../../types';

const period = (id: number, ends: string | null, status: 'open' | 'closed' = 'closed', starts: string | null = null): CoursePeriod => ({ id, name: `P${id}`, starts_on: starts, ends_on: ends, status, visible_until: null });
const course = (id: number, p: CoursePeriod | null = null): CourseSummary => ({ id, title: `C${id}`, excerpt: '', thumbnail_url: '', duration_hours: 0, level: '', language: '', progress: 0, total_lessons: 0, completed_lessons: 0, is_complete: false, grade: null, last_activity: '', period: p, color: null });

test('sin período o con período abierto: activos, en el orden del servidor', () => {
  const { active, past } = groupCourses([course(3), course(1, period(9, '2099-01-01', 'open')), course(2)]);
  expect(active.map((c) => c.id)).toEqual([3, 1, 2]);
  expect(past).toEqual([]);
});

test('períodos cerrados: un grupo por período, del más reciente al más antiguo', () => {
  const old = period(1, '2025-06-30');
  const recent = period(2, '2025-12-15');
  const { active, past } = groupCourses([course(10, old), course(11, recent), course(12), course(13, old)]);
  expect(active.map((c) => c.id)).toEqual([12]);
  expect(past.map((g) => g.period.id)).toEqual([2, 1]);
  expect(past[1]?.courses.map((c) => c.id)).toEqual([10, 13]);
});

test('mismo fin: desempata por inicio y luego por id', () => {
  const a = period(5, '2025-12-15', 'closed', '2025-07-01');
  const b = period(6, '2025-12-15', 'closed', '2025-08-01');
  const c = period(7, '2025-12-15', 'closed', '2025-08-01');
  expect(groupCourses([course(1, a), course(2, b), course(3, c)]).past.map((g) => g.period.id)).toEqual([7, 6, 5]);
});

test('servidor anterior a 6.41.0 (sin period): todo activo', () => {
  const legacy = { ...course(1) } as Partial<CourseSummary>;
  delete legacy.period;
  expect(groupCourses([legacy as CourseSummary]).active).toHaveLength(1);
});
