import { apiRequest } from './client';
import type { ProgramDetail, ProgramSummary } from '../types';

export async function fetchPrograms(token: string): Promise<ProgramSummary[]> {
  const response = await apiRequest<{ items: ProgramSummary[] }>('programs', { token });
  return response.items;
}

export async function fetchProgram(programId: number, token: string): Promise<ProgramDetail> {
  return apiRequest<ProgramDetail>(`programs/${programId}`, { token });
}

