import { apiRequest } from './client';
import type { QuizPayload, QuizResult, QuizAnswer } from '../types';

export async function fetchQuiz(lessonId: number, token: string): Promise<QuizPayload> {
  const response = await apiRequest<{ quiz: QuizPayload }>(`lessons/${lessonId}/quiz`, { token });
  return response.quiz;
}

export async function submitQuiz(
  lessonId: number,
  quizToken: string,
  answers: QuizAnswer[],
  token: string,
): Promise<QuizResult> {
  const response = await apiRequest<{ result: QuizResult }>(`lessons/${lessonId}/quiz`, {
    method: 'POST',
    token,
    body: JSON.stringify({ token: quizToken, answers }),
  });
  return response.result;
}
