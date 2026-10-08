/**
 * Sugerencia de calificación con IA (0.9.0, plugin 6.32.0). Módulo puro, para Jest.
 *
 * La IA sugiere; el docente decide. "Usar todo" o "Usar" por criterio solo
 * rellena el borrador local: **nunca guarda ni publica**. Lo que viene de la
 * sugerencia queda marcado "sugerido por IA" hasta que el docente lo edita.
 */
import type { CriterionDraft } from '../grading/drafts';
import { t, tk } from '../i18n/core';

export type SuggestedCriterion = {
  index: number;
  name: string;
  max_points: number;
  score: number | null;
  level: string | null;
  justification: string;
};

export type GradingSuggestion = {
  criteria: SuggestedCriterion[];
  feedback: string;
  ai_likelihood: 'bajo' | 'medio' | 'alto';
  ai_likelihood_note: string;
  disclaimer: string;
  model: string;
  created_at: string;
  /** 1.0.0 (plugin 6.33.1): intento con que se pidió y si ya no corresponde (otro intento o contenido cambiado). */
  attempt?: number;
  stale?: boolean;
};

export type SuggestionJob = {
  job_id: string;
  submission_id: number;
  attempt?: number;
  status: 'pending' | 'running' | 'done' | 'failed';
  suggestion: GradingSuggestion | null;
  error: string | null;
};

export const POLL_INTERVAL_MS = 3000;
/** 1.0.0 (E.4): hasta 3 minutos en total; después "Sigue generándose" y se puede volver a consultar. */
export const POLL_TIMEOUT_MS = 180_000;

/** Marca de "sugerido por IA": criterios (por índice) y la devolución general. */
export type AiMarks = { criteria: number[]; feedback: boolean };

export const NO_MARKS: AiMarks = { criteria: [], feedback: false };

/** La sugerencia sirve para el intento que el docente está viendo (y su contenido no cambió). */
export function suggestionUsable(suggestion: GradingSuggestion, viewingAttempt: number): boolean {
  return !suggestion.stale && (suggestion.attempt ?? viewingAttempt) === viewingAttempt;
}

type Fill = { scores: Record<number, CriterionDraft>; feedback: string; marks: AiMarks };

/**
 * Rellena el borrador con la sugerencia: todos los criterios (`only` ausente)
 * o uno. Con "Usar todo" también la devolución general. Lo que no tiene
 * puntaje sugerido no se toca.
 */
export function applySuggestion(
  current: { scores: Record<number, CriterionDraft>; feedback: string },
  marks: AiMarks,
  suggestion: GradingSuggestion,
  only?: number,
  viewingAttempt?: number,
): Fill {
  // De otro intento: no se usa sin pedir una nueva.
  if (viewingAttempt !== undefined && !suggestionUsable(suggestion, viewingAttempt)) {
    return { scores: current.scores, feedback: current.feedback, marks };
  }
  const scores = { ...current.scores };
  const marked = new Set(marks.criteria);
  for (const row of suggestion.criteria) {
    if (only !== undefined && row.index !== only) continue;
    if (row.score === null) continue;
    scores[row.index] = { ...(scores[row.index] ?? { score: '', feedback: '' }), score: String(row.score), feedback: row.justification };
    marked.add(row.index);
  }
  const all = only === undefined;
  return {
    scores,
    feedback: all && suggestion.feedback ? suggestion.feedback : current.feedback,
    marks: { criteria: [...marked].sort((a, b) => a - b), feedback: marks.feedback || (all && Boolean(suggestion.feedback)) },
  };
}

/** El docente editó un criterio (o la devolución): deja de estar "sugerido por IA". */
export function unmarkCriterion(marks: AiMarks, index: number): AiMarks {
  return marks.criteria.includes(index) ? { ...marks, criteria: marks.criteria.filter((i) => i !== index) } : marks;
}

export function unmarkFeedback(marks: AiMarks): AiMarks {
  return marks.feedback ? { ...marks, feedback: false } : marks;
}

export type PollDeps = {
  fetch(jobId: string): Promise<SuggestionJob>;
  sleep(ms: number): Promise<void>;
  now(): number;
  /** Para dejar de consultar si el docente salió de la pantalla. */
  cancelled?(): boolean;
};

export type PollResult = { kind: 'done'; suggestion: GradingSuggestion } | { kind: 'failed'; message: string } | { kind: 'timeout' } | { kind: 'cancelled' };

/** Errores que terminan la consulta: el trabajo no existe o no es del docente. Los de red (0), 408, 429 y 5xx no. */
function fatal(reason: unknown): boolean {
  const status = (reason as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/**
 * Consulta el mismo trabajo cada 3 s, hasta 3 minutos en total. Un corte o un
 * tiempo de espera de la red no cancela: se vuelve a consultar el mismo `job_id`.
 */
export async function pollSuggestion(jobId: string, deps: PollDeps): Promise<PollResult> {
  const started = deps.now();
  for (;;) {
    if (deps.cancelled?.()) return { kind: 'cancelled' };
    let job: SuggestionJob | null = null;
    try {
      job = await deps.fetch(jobId);
    } catch (reason) {
      if (fatal(reason)) return { kind: 'failed', message: reason instanceof Error && reason.message ? reason.message : t('La IA no pudo generar la sugerencia. Intenta más tarde.') };
    }
    if (job?.status === 'done' && job.suggestion) return { kind: 'done', suggestion: job.suggestion };
    if (job?.status === 'failed') return { kind: 'failed', message: job.error || t('La IA no pudo generar la sugerencia. Intenta más tarde.') };
    if (deps.now() - started + POLL_INTERVAL_MS > POLL_TIMEOUT_MS) return { kind: 'timeout' };
    await deps.sleep(POLL_INTERVAL_MS);
  }
}

/** Almacén clave-valor (AsyncStorage en la app). */
export type KeyValue = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type PendingSuggestion = { jobId: string; attempt: number; since: number };

/** Bajo el prefijo de caché: se borra al cerrar sesión. */
const pendingKey = (submissionId: number) => `atora.cache.ai-suggestion.${submissionId}`;
const PENDING_MAX_AGE_MS = 30 * 60_000;

/** El trabajo pedido se recuerda por entrega para retomarlo al volver a la pantalla. */
export function rememberPending(kv: KeyValue, submissionId: number, job: { jobId: string; attempt: number }, now = Date.now()): Promise<void> {
  return kv.setItem(pendingKey(submissionId), JSON.stringify({ ...job, since: now })).catch(() => undefined);
}

export async function pendingFor(kv: KeyValue, submissionId: number, now = Date.now()): Promise<PendingSuggestion | null> {
  try {
    const raw = await kv.getItem(pendingKey(submissionId));
    const value = raw ? (JSON.parse(raw) as PendingSuggestion) : null;
    if (!value || typeof value.jobId !== 'string' || now - value.since > PENDING_MAX_AGE_MS) return null;
    return value;
  } catch {
    return null;
  }
}

export function forgetPending(kv: KeyValue, submissionId: number): Promise<void> {
  return kv.removeItem(pendingKey(submissionId)).catch(() => undefined);
}

export const LIKELIHOOD_LABEL: Record<GradingSuggestion['ai_likelihood'], string> = { bajo: tk('Bajo'), medio: tk('Medio'), alto: tk('Alto') };
