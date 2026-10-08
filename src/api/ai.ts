import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticatedRequest } from './authenticated';
import { newEventId } from '../offline/outbox/runtime';
import type { Turn } from '../ai/conversation';
import type { SuggestionJob } from '../ai/suggestion';

/**
 * IA (0.9.0, plugin 6.32.0). Sin cola sin conexión: preguntar y pedir una
 * sugerencia necesitan red en el momento.
 */
export function askAssistant(token: string, lessonId: number, message: string, history: Turn[], clientEventId = newEventId()): Promise<{ reply: string; disclaimer: string; replayed: boolean }> {
  return authenticatedRequest('ai/assistant', {
    token,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lesson_id: lessonId, message, history, client_event_id: clientEventId }),
  });
}

/** 1.0.0: la sugerencia es del intento que el docente está calificando. */
export function requestSuggestion(token: string, submissionId: number, attempt: number): Promise<{ job_id: string; attempt: number; status: 'pending' }> {
  return authenticatedRequest(`teacher/submissions/${submissionId}/ai-suggestion`, {
    token,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attempt }),
  });
}

export function fetchSuggestionJob(token: string, jobId: string, attempt?: number): Promise<SuggestionJob> {
  return authenticatedRequest(`teacher/ai-suggestions/${jobId}${attempt ? `?attempt=${attempt}` : ''}`, { token });
}

// El aviso de IA se muestra la primera vez; no es dato del usuario, sobrevive al cierre de sesión.
const NOTICE_KEY = 'atora.ai.notice.seen.v1';

export async function aiNoticeSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(NOTICE_KEY).catch(() => null)) === '1';
}

export function markAiNoticeSeen(): Promise<void> {
  return AsyncStorage.setItem(NOTICE_KEY, '1').catch(() => undefined);
}
