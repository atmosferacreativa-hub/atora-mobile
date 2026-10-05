/**
 * Respuestas de un quiz en curso (0.5.0). Módulo puro: sin React Native, para Jest.
 *
 * Cada vez que se abre un quiz, el servidor genera un intento nuevo (token y
 * selección de preguntas). Para retomar sin perder nada, se guarda el intento
 * completo tal como llegó, más las respuestas, con cada cambio. Al volver se
 * retoma ese intento (aunque no haya conexión) en lugar de pedir otro.
 *
 * Se descarta al entregar o cuando el servidor cierra el intento (vencido,
 * intentos agotados, sin acceso). Un fallo de red o del servidor lo conserva.
 */
import type { QuizAnswer, QuizPayload } from '../types';

export type QuizDraft = {
  lessonId: number;
  /** El intento tal como lo entregó el servidor (incluye `token`). */
  quiz: QuizPayload;
  answers: Record<number, QuizAnswer>;
  index: number;
  /** Cuándo se abrió el intento (ms): el token del servidor vive 1 hora. */
  startedAt: number;
  savedAt: number;
};

export interface QuizDraftStore {
  get(userId: number, lessonId: number): Promise<QuizDraft | null>;
  set(userId: number, lessonId: number, draft: QuizDraft): Promise<void>;
  remove(userId: number, lessonId: number): Promise<void>;
}

/** El servidor guarda la selección de preguntas de un intento durante 1 hora. */
export const ATTEMPT_TOKEN_TTL_MS = 60 * 60 * 1000;

export function newDraft(lessonId: number, quiz: QuizPayload, now: number): QuizDraft {
  return { lessonId, quiz, answers: {}, index: 0, startedAt: now, savedAt: now };
}

export async function saveDraft(store: QuizDraftStore, userId: number, draft: QuizDraft, now: number): Promise<QuizDraft> {
  const saved = { ...draft, savedAt: now };
  await store.set(userId, draft.lessonId, saved);
  return saved;
}

/** El intento guardado de esa lección, si existe. `expired`: el servidor ya no lo aceptará. */
export async function restoreDraft(
  store: QuizDraftStore,
  userId: number,
  lessonId: number,
  now: number,
): Promise<{ draft: QuizDraft; expired: boolean } | null> {
  const draft = await store.get(userId, lessonId);
  if (!draft || !draft.quiz?.token) return null;
  return { draft, expired: now - draft.startedAt > ATTEMPT_TOKEN_TTL_MS };
}

export async function discardDraft(store: QuizDraftStore, userId: number, lessonId: number): Promise<void> {
  await store.remove(userId, lessonId);
}

/**
 * Qué hacer con el intento guardado si la entrega falla.
 * - `discard`: el servidor cerró el intento (403/404/409/410/422): se muestra su motivo tal cual.
 * - `keep`: sin conexión, error del servidor o 429: se reintenta con las mismas respuestas.
 */
export function afterSubmitFailure(status: number): 'discard' | 'keep' {
  if (status === 0 || status === 408 || status === 429 || status >= 500) return 'keep';
  if (status === 401) return 'keep';
  return status >= 400 ? 'discard' : 'keep';
}

/** Respuestas en el formato que espera el servidor (en el orden de las preguntas del intento). */
export function answersPayload(draft: QuizDraft): QuizAnswer[] {
  return draft.quiz.questions.map((question) => draft.answers[question.id] ?? (question.type === 'multiple' ? [] : ''));
}
