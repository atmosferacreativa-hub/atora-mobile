import { countdown, formatLocalStart, liveState, needsJoinUrl } from '../liveClass';
import type { LiveInfo } from '../../types';

const base: LiveInfo = {
  status: 'scheduled',
  provider: 'zoom',
  provider_label: 'Zoom',
  starts_at: '2026-11-03T22:00:00Z',
  ends_at: '2026-11-03T23:00:00Z',
  timezone: 'America/Caracas',
  starts_in_sec: 3600,
  opens_at: '2026-11-03T21:50:00Z',
  join_url: '',
  is_host: false,
  notes: '',
  recording_mode: 'none',
  recording: null,
};
const at = (iso: string) => Date.parse(iso);

describe('liveState', () => {
  it('abre 10 min antes y cierra 15 min después del final', () => {
    expect(liveState(base, at('2026-11-03T21:49:59Z'))).toBe('scheduled');
    expect(liveState(base, at('2026-11-03T21:50:00Z'))).toBe('open');
    expect(liveState(base, at('2026-11-03T23:15:00Z'))).toBe('open');
    expect(liveState(base, at('2026-11-03T23:15:01Z'))).toBe('ended');
  });
  it('sin fecha: sin programar', () => {
    expect(liveState({ starts_at: null, ends_at: null }, 0)).toBe('unscheduled');
  });
});

describe('countdown', () => {
  it('días, horas y minutos redondeando hacia arriba', () => {
    expect(countdown(base, at('2026-11-02T20:59:30Z'))).toEqual({ days: 1, hours: 1, minutes: 1 });
    expect(countdown(base, at('2026-11-03T21:55:00Z'))).toEqual({ days: 0, hours: 0, minutes: 5 });
    expect(countdown(base, at('2026-11-03T22:00:01Z'))).toBeNull();
  });
});

describe('needsJoinUrl', () => {
  it('pide la lección cuando la clase abre en el teléfono y el servidor aún no dio el enlace', () => {
    expect(needsJoinUrl(base, at('2026-11-03T21:51:00Z'))).toBe(true);
    expect(needsJoinUrl(base, at('2026-11-03T21:00:00Z'))).toBe(false);
    expect(needsJoinUrl({ ...base, status: 'open', join_url: 'https://zoom.test/j/1' }, at('2026-11-03T21:51:00Z'))).toBe(false);
    // El servidor ya dijo "abierta" sin enlace (p. ej. falta cargarlo): no insistir en bucle.
    expect(needsJoinUrl({ ...base, status: 'open' }, at('2026-11-03T21:51:00Z'))).toBe(false);
  });
});

describe('formatLocalStart', () => {
  it('muestra la hora en la zona pedida, no en UTC', () => {
    const caracas = formatLocalStart(base.starts_at, 'en-US', 'America/Caracas');
    expect(caracas).toMatch(/06:00\s?PM/);
    const tokyo = formatLocalStart(base.starts_at, 'en-US', 'Asia/Tokyo');
    expect(tokyo).toMatch(/07:00\s?AM/);
  });
  it('fecha inválida: vacío', () => {
    expect(formatLocalStart('no', 'es')).toBe('');
    expect(formatLocalStart(null, 'es')).toBe('');
  });
});
