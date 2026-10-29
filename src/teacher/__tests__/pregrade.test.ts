import { canReturn, confirmText, onlyPregrades, pregradeBanner, publishLabel, savedKind, savedMessage } from '../pregrade';
import type { Pregrade } from '../types';

const pending: Pregrade = { pending: true, by: { id: 7, name: 'Asistente Uno' }, at: '2026-11-01T10:00:00Z', action: 'publish', returned: null };
const returned: Pregrade = { pending: false, by: null, at: null, action: null, returned: { by: 'Instructora', at: '2026-11-01T11:00:00Z', comment: 'Revisa el criterio 2.' } };

describe('pre-calificación', () => {
  it('el asistente envía al instructor; el instructor (o un servidor viejo) publica', () => {
    expect(onlyPregrades({ can_publish: false })).toBe(true);
    expect(onlyPregrades({ can_publish: true })).toBe(false);
    expect(onlyPregrades({})).toBe(false);
    expect(publishLabel({ can_publish: false })).toBe('Enviar al instructor');
    expect(publishLabel({})).toBe('Publicar');
    expect(confirmText({ can_publish: false, group: null }).title).toBe('¿Enviar al instructor?');
  });

  it('lo guardado se describe según la respuesta del servidor', () => {
    expect(savedKind(false, { pregrade: null, status: 'draft' })).toBe('draft');
    expect(savedKind(true, { pregrade: pending, status: 'draft' })).toBe('pregrade');
    expect(savedKind(true, { pregrade: null, status: 'graded' })).toBe('published');
    expect(savedMessage('pregrade')).toBe('Enviada al instructor: el estudiante todavía no la ve');
  });

  it('aviso y devolución según quién mira', () => {
    expect(pregradeBanner(pending, true)).toContain('Pre-calificación de Asistente Uno');
    expect(pregradeBanner(pending, false)).toBe('Enviada al instructor: está por validar.');
    expect(pregradeBanner(returned, false)).toBe('Instructora devolvió la pre-calificación: Revisa el criterio 2.');
    expect(pregradeBanner(null, true)).toBeNull();
    expect(canReturn({ pregrade: pending, can_publish: true })).toBe(true);
    expect(canReturn({ pregrade: pending, can_publish: false })).toBe(false);
    expect(canReturn({ pregrade: returned, can_publish: true })).toBe(false);
  });
});
