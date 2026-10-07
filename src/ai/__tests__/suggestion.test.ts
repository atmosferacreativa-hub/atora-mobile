import { applySuggestion, NO_MARKS, pollSuggestion, POLL_INTERVAL_MS, unmarkCriterion, unmarkFeedback, type GradingSuggestion, type SuggestionJob } from '../suggestion';

const suggestion: GradingSuggestion = {
  criteria: [
    { index: 0, name: 'Claridad', max_points: 10, score: 8.5, level: 'entre Logrado y Excelente', justification: 'Ideas claras.' },
    { index: 1, name: 'Estructura', max_points: 10, score: 10, level: 'Excelente', justification: 'Buen orden.' },
    { index: 2, name: 'Fuentes', max_points: 5, score: null, level: null, justification: '' },
  ],
  feedback: 'Buen trabajo.',
  ai_likelihood: 'medio',
  ai_likelihood_note: 'Frases uniformes.',
  disclaimer: 'Indicio no concluyente. Verifica con el estudiante antes de decidir.',
  model: 'simulado',
  created_at: '2026-10-06T12:00:00Z',
};

const empty = { scores: { 0: { score: '', feedback: '' }, 1: { score: '4', feedback: 'Mío' }, 2: { score: '3', feedback: '' } }, feedback: '' };

describe('usar la sugerencia rellena el borrador sin enviar', () => {
  it('"Usar todo" rellena puntajes, justificaciones y la devolución, y los marca', () => {
    const send = jest.fn();
    const out = applySuggestion(empty, NO_MARKS, suggestion);
    expect(out.scores[0]).toEqual({ score: '8.5', feedback: 'Ideas claras.' });
    expect(out.scores[1]).toEqual({ score: '10', feedback: 'Buen orden.' });
    expect(out.scores[2]).toEqual({ score: '3', feedback: '' });
    expect(out.feedback).toBe('Buen trabajo.');
    expect(out.marks).toEqual({ criteria: [0, 1], feedback: true });
    expect(send).not.toHaveBeenCalled();
    expect(empty.scores[0]!.score).toBe('');
  });

  it('"Usar" en un criterio toca solo ese, sin la devolución general', () => {
    const out = applySuggestion(empty, NO_MARKS, suggestion, 1);
    expect(out.scores[0]).toEqual({ score: '', feedback: '' });
    expect(out.scores[1]).toEqual({ score: '10', feedback: 'Buen orden.' });
    expect(out.feedback).toBe('');
    expect(out.marks).toEqual({ criteria: [1], feedback: false });
  });

  it('la marca "sugerido por IA" se quita al editar', () => {
    const { marks } = applySuggestion(empty, NO_MARKS, suggestion);
    expect(unmarkCriterion(marks, 0)).toEqual({ criteria: [1], feedback: true });
    expect(unmarkFeedback(marks)).toEqual({ criteria: [0, 1], feedback: false });
  });
});

describe('consulta del trabajo', () => {
  const job = (status: SuggestionJob['status']): SuggestionJob => ({ job_id: 'j', submission_id: 1, status, suggestion: status === 'done' ? suggestion : null, error: status === 'failed' ? 'Falló.' : null });

  it('consulta cada 3 s hasta que termina', async () => {
    const states: SuggestionJob['status'][] = ['pending', 'pending', 'done'];
    const sleeps: number[] = [];
    let t = 0;
    const result = await pollSuggestion('j', { fetch: async () => job(states.shift()!), sleep: async (ms) => { sleeps.push(ms); t += ms; }, now: () => t });
    expect(result).toEqual({ kind: 'done', suggestion });
    expect(sleeps).toEqual([POLL_INTERVAL_MS, POLL_INTERVAL_MS]);
  });

  it('se rinde a los 2 minutos', async () => {
    let t = 0;
    let calls = 0;
    const result = await pollSuggestion('j', { fetch: async () => { calls += 1; return job('pending'); }, sleep: async (ms) => { t += ms; }, now: () => t });
    expect(result).toEqual({ kind: 'timeout' });
    expect(t).toBeLessThanOrEqual(120_000);
    expect(calls).toBe(41); // en 0, 3, …, 120 s
  });

  it('informa el error del servidor y para si se sale de la pantalla', async () => {
    expect(await pollSuggestion('j', { fetch: async () => job('failed'), sleep: async () => undefined, now: () => 0 })).toEqual({ kind: 'failed', message: 'Falló.' });
    expect(await pollSuggestion('j', { fetch: async () => job('pending'), sleep: async () => undefined, now: () => 0, cancelled: () => true })).toEqual({ kind: 'cancelled' });
  });
});
