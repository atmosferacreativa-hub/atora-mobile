import { applySuggestion, forgetPending, NO_MARKS, pendingFor, rememberPending, suggestionUsable, POLL_TIMEOUT_MS, type KeyValue, pollSuggestion, POLL_INTERVAL_MS, unmarkCriterion, unmarkFeedback, type GradingSuggestion, type SuggestionJob } from '../suggestion';

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

describe('la sugerencia es de un intento (E.3)', () => {
  const of = (attempt: number, stale = false): GradingSuggestion => ({ ...suggestion, attempt, stale });

  it('sirve solo para el intento con que se pidió y si el contenido no cambió', () => {
    expect(suggestionUsable(of(2), 2)).toBe(true);
    expect(suggestionUsable(of(1), 2)).toBe(false);
    expect(suggestionUsable(of(2, true), 2)).toBe(false);
  });

  it('"Usar" no rellena nada con una sugerencia de otro intento', () => {
    const out = applySuggestion(empty, NO_MARKS, of(1), undefined, 2);
    expect(out.scores).toEqual(empty.scores);
    expect(out.feedback).toBe('');
    expect(out.marks).toEqual(NO_MARKS);
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

  it('se rinde a los 3 minutos en total (E.4)', async () => {
    let t = 0;
    let calls = 0;
    const result = await pollSuggestion('j', { fetch: async () => { calls += 1; return job('pending'); }, sleep: async (ms) => { t += ms; }, now: () => t });
    expect(result).toEqual({ kind: 'timeout' });
    expect(POLL_TIMEOUT_MS).toBe(180_000);
    expect(t).toBeLessThanOrEqual(180_000);
    expect(calls).toBe(61); // en 0, 3, …, 180 s
  });

  it('un corte o un tiempo de espera de la red no cancela: sigue consultando el mismo trabajo (E.4)', async () => {
    const seen: string[] = [];
    const answers: Array<() => SuggestionJob> = [
      () => { throw Object.assign(new Error('timeout'), { status: 0, code: 'request_timeout' }); },
      () => { throw Object.assign(new Error('caído'), { status: 503 }); },
      () => job('pending'),
      () => job('done'),
    ];
    const result = await pollSuggestion('j', { fetch: async (id) => { seen.push(id); return answers.shift()!(); }, sleep: async () => undefined, now: () => 0 });
    expect(result).toEqual({ kind: 'done', suggestion });
    expect(seen).toEqual(['j', 'j', 'j', 'j']);
  });

  it('un trabajo que ya no existe (404) sí termina la consulta', async () => {
    const result = await pollSuggestion('j', { fetch: async () => { throw Object.assign(new Error('No encontrado.'), { status: 404 }); }, sleep: async () => undefined, now: () => 0 });
    expect(result).toEqual({ kind: 'failed', message: 'No encontrado.' });
  });

  it('informa el error del servidor y para si se sale de la pantalla', async () => {
    expect(await pollSuggestion('j', { fetch: async () => job('failed'), sleep: async () => undefined, now: () => 0 })).toEqual({ kind: 'failed', message: 'Falló.' });
    expect(await pollSuggestion('j', { fetch: async () => job('pending'), sleep: async () => undefined, now: () => 0, cancelled: () => true })).toEqual({ kind: 'cancelled' });
  });
});

describe('el trabajo pendiente se retoma al volver (E.4)', () => {
  const memory = (): KeyValue & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return {
      data,
      getItem: async (k) => data[k] ?? null,
      setItem: async (k, v) => { data[k] = v; },
      removeItem: async (k) => { delete data[k]; },
    };
  };

  it('guarda el job_id por entrega y lo devuelve hasta que termina', async () => {
    const kv = memory();
    await rememberPending(kv, 12, { jobId: 'j-12', attempt: 2 }, 1_000);
    expect(await pendingFor(kv, 12, 5_000)).toEqual({ jobId: 'j-12', attempt: 2, since: 1_000 });
    expect(await pendingFor(kv, 13, 5_000)).toBeNull();
    expect(Object.keys(kv.data)[0]).toMatch(/^atora\.cache\./); // se borra al cerrar sesión
    await forgetPending(kv, 12);
    expect(await pendingFor(kv, 12, 5_000)).toBeNull();
  });

  it('uno muy viejo (más de 30 min) ya no se retoma', async () => {
    const kv = memory();
    await rememberPending(kv, 12, { jobId: 'j-12', attempt: 1 }, 0);
    expect(await pendingFor(kv, 12, 31 * 60_000)).toBeNull();
  });
});
