import { authenticatedRequest } from './authenticated';
import type { QuizPayload, QuizResult, QuizAnswer } from '../types';

export async function fetchQuiz(lessonId: number, token: string): Promise<QuizPayload> {
  const response = await authenticatedRequest<{ quiz: QuizPayload }>(`lessons/${lessonId}/quiz`, { token });
  return response.quiz;
}

export async function submitQuiz(
  lessonId: number,
  quizToken: string,
  answers: QuizAnswer[],
  token: string,
): Promise<QuizResult> {
  const response = await authenticatedRequest<{ result: QuizResult }>(`lessons/${lessonId}/quiz`, {
    method: 'POST',
    token,
    body: JSON.stringify({ token: quizToken, answers }),
  });
  return response.result;
}
