import { cacheDelete, cacheGet, cacheSet } from '../offline/localCache';
import type { GradingDraft, GradingDraftStore } from './drafts';

/** Borradores de calificación en la base local (se borra entera al cerrar sesión). */
export const sqliteGradingDraftStore: GradingDraftStore = {
  get: (userId, submissionId) => cacheGet<GradingDraft>(userId, 'grading_draft', submissionId),
  set: (userId, submissionId, draft) => cacheSet(userId, 'grading_draft', submissionId, draft),
  remove: (userId, submissionId) => cacheDelete(userId, 'grading_draft', submissionId),
};
