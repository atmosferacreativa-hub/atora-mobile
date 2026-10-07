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
};

export type SuggestionJob = {
  job_id: string;
  submission_id: number;
  status: 'pending' | 'done' | 'failed';
  suggestion: GradingSuggestion | null;
  error: string | null;
};

export const POLL_INTERVAL_MS = 3000;
export const POLL_TIMEOUT_MS = 120_000;

/** Marca de "sugerido por IA": criterios (por índice) y la devolución general. */
export type AiMarks = { criteria: number[]; feedback: boolean };

export const NO_MARKS: AiMarks = { criteria: [], feedback: false };

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
): Fill {
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

/** Consulta cada 3 s, hasta 2 minutos. */
export async function pollSuggestion(jobId: string, deps: PollDeps): Promise<PollResult> {
  const started = deps.now();
  for (;;) {
    if (deps.cancelled?.()) return { kind: 'cancelled' };
    const job = await deps.fetch(jobId);
    if (job.status === 'done' && job.suggestion) return { kind: 'done', suggestion: job.suggestion };
    if (job.status === 'failed') return { kind: 'failed', message: job.error || t('La IA no pudo generar la sugerencia. Intenta más tarde.') };
    if (deps.now() - started + POLL_INTERVAL_MS > POLL_TIMEOUT_MS) return { kind: 'timeout' };
    await deps.sleep(POLL_INTERVAL_MS);
  }
}

export const LIKELIHOOD_LABEL: Record<GradingSuggestion['ai_likelihood'], string> = { bajo: tk('Bajo'), medio: tk('Medio'), alto: tk('Alto') };
