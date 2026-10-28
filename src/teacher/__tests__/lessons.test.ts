import { hasDeadline, initialDue, isValidDate, shiftDate, todayIn } from '../lessons';

describe('fechas de entrega', () => {
  it('valida fechas reales', () => {
    expect(isValidDate('2026-11-30')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-11-3')).toBe(false);
  });
  it('suma días cruzando meses y años', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2026-11-10', 7)).toBe('2026-11-17');
  });
  it('hoy en la zona del sitio, no la del teléfono', () => {
    // 2026-11-10 02:00 UTC = 9 de noviembre 22:00 en Caracas.
    const now = new Date('2026-11-10T02:00:00Z');
    expect(todayIn('America/Caracas', now)).toBe('2026-11-09');
    expect(todayIn('Asia/Tokyo', now)).toBe('2026-11-10');
  });
  it('fecha inicial: la de la tarea, o una semana desde hoy', () => {
    expect(initialDue({ due_date: '2026-11-20', due_time: '18:00' })).toEqual({ date: '2026-11-20', time: '18:00' });
    expect(initialDue({ due_date: null, due_time: null, site_timezone: 'America/Caracas' }, new Date('2026-11-10T02:00:00Z'))).toEqual({ date: '2026-11-16', time: '23:59' });
  });
  it('solo las actividades con entrega llevan fecha', () => {
    expect(hasDeadline({ type: 'tarea', due_date: null })).toBe(true);
    expect(hasDeadline({ type: 'lectura', due_date: null })).toBe(false);
    expect(hasDeadline({ type: 'lectura', due_date: '2026-11-10' })).toBe(true);
  });
});
