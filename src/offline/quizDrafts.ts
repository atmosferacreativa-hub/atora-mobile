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
import { t } from '../i18n/core';

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

/**
 * Segundos que quedan según el servidor (0.5.2): `remaining_seconds` es lo que el
 * servidor calculó al abrir el intento (límite menos lo transcurrido desde que
 * lo emitió); se le resta lo que pasó desde entonces. `null` si no hay límite.
 */
export function remainingSeconds(draft: QuizDraft, now: number): number | null {
  const fromServer = draft.quiz.remaining_seconds;
  if (!fromServer || fromServer <= 0) return null;
  return Math.max(0, fromServer - Math.floor((now - draft.startedAt) / 1000));
}

export type PendingQuiz = { lessonId: number; answered: number; total: number; remainingSeconds: number | null };

function answered(value: QuizAnswer | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim() !== '' : value !== undefined && value !== null;
}

/**
 * Intentos guardados sin entregar, para el aviso en Hoy y en el curso.
 * Un intento que el servidor ya no acepta (token vencido) no se anuncia.
 */
export function pendingQuizzes(drafts: QuizDraft[], now: number): PendingQuiz[] {
  return drafts
    .filter((draft) => draft?.quiz?.token && now - draft.startedAt <= ATTEMPT_TOKEN_TTL_MS)
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((draft) => ({
      lessonId: draft.lessonId,
      answered: draft.quiz.questions.filter((question) => answered(draft.answers[question.id])).length,
      total: draft.quiz.questions.length,
      remainingSeconds: remainingSeconds(draft, now),
    }));
}

/** Texto del tiempo en el aviso. */
export function remainingLabel(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds <= 0) return t('El tiempo terminó');
  if (seconds < 60) return `Quedan ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Quedan ${minutes} min`;
  return `Quedan ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
