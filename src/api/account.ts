import { authenticatedRequest } from './authenticated';

export type DeletionRequest = { request_id: number; status: 'pending' | 'processed'; requested_at: string; deadline: string; message: string; replayed: boolean };

/** 1.0.0 (plugin 6.33.0): pide a la academia que elimine la cuenta y los datos personales. */
export function requestAccountDeletion(token: string, note = ''): Promise<DeletionRequest> {
  return authenticatedRequest<DeletionRequest>('account/deletion-request', {
    token,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
}
