/**
 * Borrador local de una calificación (0.8.0). Módulo puro, para Jest.
 *
 * Calificar exige conexión, pero lo que el docente escribe se guarda en el
 * teléfono a cada cambio: si la app se cierra o se cae la señal, se recupera
 * al volver a abrir la entrega. **Nunca se envía solo.** Se descarta al
 * guardar en el servidor (borrador o publicada) o si el docente lo descarta.
 */
export type CriterionDraft = { score: string; feedback: string };

export type GradingDraft = {
  submissionId: number;
  /** Revisión de la entrega cuando se empezó (para avisar si otro docente guardó después). */
  revision: number;
  attempt: number;
  scores: Record<number, CriterionDraft>;
  feedback: string;
  grade: string;
  savedAt: number;
};

export interface GradingDraftStore {
  get(userId: number, submissionId: number): Promise<GradingDraft | null>;
  set(userId: number, submissionId: number, draft: GradingDraft): Promise<void>;
  remove(userId: number, submissionId: number): Promise<void>;
}

/** ¿Hay algo escrito? Un borrador vacío no se guarda (ni se ofrece recuperar). */
export function hasContent(draft: Pick<GradingDraft, 'scores' | 'feedback' | 'grade'>): boolean {
  if (draft.feedback.trim() || draft.grade.trim()) return true;
  return Object.values(draft.scores).some((c) => c.score.trim() !== '' || c.feedback.trim() !== '');
}

/** Guarda a cada cambio; si quedó vacío, lo borra. */
export async function saveDraft(store: GradingDraftStore, userId: number, draft: GradingDraft, now = Date.now()): Promise<void> {
  if (!hasContent(draft)) {
    await store.remove(userId, draft.submissionId);
    return;
  }
  await store.set(userId, draft.submissionId, { ...draft, savedAt: now });
}

export type Recovery = { draft: GradingDraft; staleRevision: boolean } | null;

/**
 * Al abrir la entrega: el borrador guardado, si hay. `staleRevision` avisa que
 * otro docente guardó después de empezarlo (revisar antes de guardar).
 */
export async function recoverDraft(store: GradingDraftStore, userId: number, submissionId: number, serverRevision: number): Promise<Recovery> {
  const draft = await store.get(userId, submissionId);
  if (!draft || draft.submissionId !== submissionId || !hasContent(draft)) return null;
  return { draft, staleRevision: serverRevision > draft.revision };
}

/** Tras guardar en el servidor (borrador o publicada): el borrador local ya no hace falta. */
export function discardDraft(store: GradingDraftStore, userId: number, submissionId: number): Promise<void> {
  return store.remove(userId, submissionId);
}
