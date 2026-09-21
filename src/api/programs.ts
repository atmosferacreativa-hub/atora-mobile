import { authenticatedRequest } from './authenticated';
import type { ProgramDetail, ProgramSummary } from '../types';

export async function fetchPrograms(token: string): Promise<ProgramSummary[]> {
  const response = await authenticatedRequest<{ items: ProgramSummary[] }>('programs', { token });
  return response.items;
}

export async function fetchProgram(programId: number, token: string): Promise<ProgramDetail> {
  return authenticatedRequest<ProgramDetail>(`programs/${programId}`, { token });
}
