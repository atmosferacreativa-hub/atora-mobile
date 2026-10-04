import { authenticatedRequest } from './authenticated';
import type { SyncPage } from '../offline/sync/plan';

/** 6.28.0: cambios desde el cursor (vacío = estado completo). */
export function fetchChanges(cursor: string, token: string): Promise<SyncPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return authenticatedRequest<SyncPage>(`sync/changes${query}`, { token });
}
