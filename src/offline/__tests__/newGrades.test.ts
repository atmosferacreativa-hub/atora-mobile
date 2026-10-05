import { baseline, coursesWithNewGrades, markSeen } from '../newGrades';

describe('aviso de nota nueva', () => {
  const now = [
    { course_id: 3, graded_count: 2, last_graded_at: '2026-10-04T10:00:00Z' },
    { course_id: 8, graded_count: 0, last_graded_at: null },
  ];

  it('la primera sincronización toma lo existente como visto', () => {
    const seen = baseline(null, now);
    expect(coursesWithNewGrades(seen, now)).toEqual([]);
  });

  it('una calificación nueva liberada enciende el aviso del curso', () => {
    const seen = baseline(null, now);
    const later = [{ course_id: 3, graded_count: 3, last_graded_at: '2026-10-05T09:00:00Z' }, now[1]!];
    expect(coursesWithNewGrades(seen, later)).toEqual([3]);
    expect(coursesWithNewGrades(seen, [now[0]!, { course_id: 8, graded_count: 1, last_graded_at: '2026-10-05T09:00:00Z' }])).toEqual([8]);
  });

  it('una nota recalificada (misma cantidad, fecha nueva) también avisa', () => {
    const seen = baseline(null, now);
    expect(coursesWithNewGrades(seen, [{ course_id: 3, graded_count: 2, last_graded_at: '2026-10-06T00:00:00Z' }])).toEqual([3]);
  });

  it('al ver las notas del curso, el aviso se apaga solo para ese curso', () => {
    const seen = baseline(null, now);
    const later = [{ course_id: 3, graded_count: 3, last_graded_at: '2026-10-05T09:00:00Z' }, { course_id: 8, graded_count: 1, last_graded_at: '2026-10-05T09:00:00Z' }];
    const after = markSeen(seen, later, [3]);
    expect(coursesWithNewGrades(after, later)).toEqual([8]);
  });
});
