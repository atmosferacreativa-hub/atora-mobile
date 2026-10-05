import { afterSubmitFailure, answersPayload, ATTEMPT_TOKEN_TTL_MS, discardDraft, newDraft, pendingQuizzes, remainingLabel, remainingSeconds, restoreDraft, saveDraft, type QuizDraft, type QuizDraftStore } from '../quizDrafts';
import type { QuizPayload } from '../../types';

class MemoryStore implements QuizDraftStore {
  data = new Map<string, QuizDraft>();
  async get(userId: number, lessonId: number) { return this.data.get(`${userId}:${lessonId}`) ?? null; }
  async set(userId: number, lessonId: number, draft: QuizDraft) { this.data.set(`${userId}:${lessonId}`, JSON.parse(JSON.stringify(draft))); }
  async remove(userId: number, lessonId: number) { this.data.delete(`${userId}:${lessonId}`); }
}

const quiz = (token: string): QuizPayload => ({
  lesson_id: 7,
  token,
  questions: [
    { id: 1, type: 'single', question: '¿A?', options: ['x', 'y'], weight: 1 },
    { id: 2, type: 'multiple', question: '¿B?', options: ['x', 'y'], weight: 1 },
    { id: 3, type: 'text', question: '¿C?', options: [], weight: 1 },
  ],
  can_submit: true,
  remaining_seconds: 0,
  attempts: 0,
  best_score: null,
  retry_context: {},
});

describe('respuestas de quiz guardadas', () => {
  it('guarda con cada cambio y restaura el mismo intento (token y preguntas)', async () => {
    const store = new MemoryStore();
    let draft = newDraft(7, quiz('tok-intento-1'), 1_000);
    draft = await saveDraft(store, 5, { ...draft, answers: { 1: 'y' }, index: 1 }, 2_000);
    draft = await saveDraft(store, 5, { ...draft, answers: { ...draft.answers, 2: ['x'] } }, 3_000);

    const restored = await restoreDraft(store, 5, 7, 4_000);
    expect(restored?.expired).toBe(false);
    expect(restored?.draft.quiz.token).toBe('tok-intento-1');
    expect(restored?.draft.answers).toEqual({ 1: 'y', 2: ['x'] });
    expect(restored?.draft.index).toBe(1);
    expect(answersPayload(restored!.draft)).toEqual(['y', ['x'], '']);
  });

  it('cada usuario y lección tiene su intento', async () => {
    const store = new MemoryStore();
    await saveDraft(store, 5, newDraft(7, quiz('a'), 0), 0);
    expect(await restoreDraft(store, 6, 7, 0)).toBeNull();
    expect(await restoreDraft(store, 5, 8, 0)).toBeNull();
  });

  it('un intento abierto hace más de una hora se marca vencido', async () => {
    const store = new MemoryStore();
    await saveDraft(store, 5, newDraft(7, quiz('a'), 0), 0);
    expect((await restoreDraft(store, 5, 7, ATTEMPT_TOKEN_TTL_MS + 1))?.expired).toBe(true);
  });

  it('se descarta al entregar', async () => {
    const store = new MemoryStore();
    await saveDraft(store, 5, newDraft(7, quiz('a'), 0), 0);
    await discardDraft(store, 5, 7);
    expect(await restoreDraft(store, 5, 7, 0)).toBeNull();
  });

  it('el servidor que cierra el intento lo descarta; un fallo de red lo conserva', () => {
    expect(afterSubmitFailure(409)).toBe('discard'); // vencido o intentos agotados
    expect(afterSubmitFailure(403)).toBe('discard');
    expect(afterSubmitFailure(0)).toBe('keep');      // sin conexión
    expect(afterSubmitFailure(503)).toBe('keep');
    expect(afterSubmitFailure(429)).toBe('keep');    // entrega en proceso
  });

  it('aviso de evaluación sin entregar: cuenta respuestas y descuenta el tiempo informado por el servidor', () => {
    const timed = { ...quiz('tok-t'), remaining_seconds: 600 };
    const draft = { ...newDraft(7, timed, 1_000_000), answers: { 1: 'y', 2: [] as string[] }, savedAt: 1_000_000 };
    const [item] = pendingQuizzes([draft], 1_000_000 + 125_000);
    expect(item).toEqual({ lessonId: 7, answered: 1, total: 3, remainingSeconds: 475 });
    expect(remainingLabel(item?.remainingSeconds ?? null)).toBe('Quedan 7 min');
    expect(remainingSeconds(draft, 1_000_000 + 700_000)).toBe(0);
    expect(remainingLabel(0)).toBe('El tiempo terminó');
  });

  it('sin límite no hay tiempo; un intento vencido no se anuncia', () => {
    const draft = newDraft(7, quiz('tok-s'), 0);
    expect(pendingQuizzes([draft], 1_000)[0]?.remainingSeconds).toBeNull();
    expect(remainingLabel(null)).toBe('');
    expect(pendingQuizzes([draft], ATTEMPT_TOKEN_TTL_MS + 1)).toEqual([]);
  });
});
