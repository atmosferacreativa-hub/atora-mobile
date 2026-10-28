import { buildMarks, counts, markAllPresent, withPending, type AttendanceRoster, type RosterStudent } from '../attendance';

const students: RosterStudent[] = [
  { id: 1, name: 'Ana', status: null, note: '', marked_at: null },
  { id: 2, name: 'Beto', status: 'ausente', note: '', marked_at: '2026-11-03T12:00:00.000Z' },
  { id: 3, name: 'Caro', status: null, note: '', marked_at: null },
];

describe('asistencia', () => {
  it('«todos presentes» no pisa marcas existentes ni lo ya tocado', () => {
    const local = markAllPresent(students, { 3: { status: 'tarde', note: 'Bus' } });
    expect(local).toEqual({ 1: { status: 'presente', note: '' }, 3: { status: 'tarde', note: 'Bus' } });
  });

  it('envía solo lo que cambió y la nota solo para tarde o justificado', () => {
    const marks = buildMarks(students, {
      1: { status: 'presente', note: 'ignorada' },
      2: { status: 'ausente', note: '' },
      3: { status: 'justificado', note: '  Cita  ' },
    }, '2026-11-03T12:30:00.000Z');
    expect(marks).toEqual([
      { student_id: 1, status: 'presente', note: '', marked_at: '2026-11-03T12:30:00.000Z' },
      { student_id: 3, status: 'justificado', note: 'Cita', marked_at: '2026-11-03T12:30:00.000Z' },
    ]);
  });

  it('lo pendiente en la cola se ve encima; gana la marca más reciente', () => {
    const roster: AttendanceRoster = { session: { id: 0, course_id: 9, lesson_id: 0, date: '2026-11-03', starts_at: null, title: 'Clase' }, students };
    const view = withPending(roster, [
      { courseId: 9, lessonId: 0, date: '2026-11-03', marks: [{ student_id: 1, status: 'presente', note: '', marked_at: '2026-11-03T12:10:00.000Z' }] },
      { courseId: 9, lessonId: 0, date: '2026-11-03', marks: [{ student_id: 1, status: 'tarde', note: 'Bus', marked_at: '2026-11-03T12:20:00.000Z' }] },
      // Más vieja que lo que ya tiene el servidor: no se muestra encima.
      { courseId: 9, lessonId: 0, date: '2026-11-03', marks: [{ student_id: 2, status: 'presente', note: '', marked_at: '2026-11-03T11:00:00.000Z' }] },
      // Otra fecha: no aplica.
      { courseId: 9, lessonId: 0, date: '2026-11-04', marks: [{ student_id: 3, status: 'presente', note: '', marked_at: '2026-11-04T12:00:00.000Z' }] },
    ]);
    expect(view.map((s) => s.status)).toEqual(['tarde', 'ausente', null]);
    expect(counts(view)).toEqual({ presente: 0, tarde: 1, ausente: 1, justificado: 0, sin_marcar: 1 });
  });
});
