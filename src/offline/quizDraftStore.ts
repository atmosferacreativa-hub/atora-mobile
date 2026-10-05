import { cacheDelete, cacheGet, cacheSet } from './localCache';
import type { QuizDraft, QuizDraftStore } from './quizDrafts';

/** Intentos de quiz en la base local (se borra entera al cerrar sesión). */
export const sqliteQuizDraftStore: QuizDraftStore = {
  get: (userId, lessonId) => cacheGet<QuizDraft>(userId, 'quiz_draft', lessonId),
  set: (userId, lessonId, draft) => cacheSet(userId, 'quiz_draft', lessonId, draft),
  remove: (userId, lessonId) => cacheDelete(userId, 'quiz_draft', lessonId),
};
