import { riskA11y, riskBadge } from '../risk';

describe('señal de riesgo del estudiante (0.7.0)', () => {
  it('siempre da texto además del color, con el motivo del servidor', () => {
    const badge = riskBadge({ level: 'alto', label: 'Riesgo alto', reasons: ['2 entregas vencidas', 'nota acumulada 48/100'] });
    expect(badge).toEqual({ icon: 'alert-circle', tone: 'danger', text: 'Riesgo alto', detail: '2 entregas vencidas · nota acumulada 48/100' });
    expect(riskA11y({ level: 'alto', label: 'Riesgo alto', reasons: ['2 entregas vencidas'] })).toBe('Riesgo alto: 2 entregas vencidas');
  });

  it('nivel medio y sin riesgo', () => {
    expect(riskBadge({ level: 'medio', label: 'Riesgo medio', reasons: ['1 entrega vencida'] })).toMatchObject({ tone: 'warning', text: 'Riesgo medio', detail: '1 entrega vencida' });
    expect(riskBadge({ level: 'bajo', label: 'Sin riesgo', reasons: [] })).toMatchObject({ tone: 'ok', text: 'Sin riesgo', detail: 'Al día' });
  });

  it('sin dato o con un nivel desconocido no se rompe', () => {
    expect(riskBadge(null)).toMatchObject({ tone: 'ok', text: 'Sin riesgo' });
    expect(riskBadge({ level: 'raro' as never, label: '', reasons: [] })).toMatchObject({ tone: 'ok', text: 'Sin riesgo' });
    expect(riskBadge({ level: 'alto', label: '', reasons: [] }).text).toBe('Riesgo alto');
  });
});
