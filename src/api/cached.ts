import { ApiError, isRetriableError } from './client';
import { authenticatedRequest } from './authenticated';
import { getSessionUserId } from './session';
import { cacheGet, cacheSet, type CacheKind } from '../offline/localCache';

/**
 * Lectura con respaldo local (0.6.0): con conexión guarda lo recibido con su
 * fecha; sin conexión (o con error de red/servidor) devuelve lo último guardado.
 * Un error del servidor que no se arregla reintentando (403, 404…) se propaga.
 */
export type Synced<T> = { data: T; syncedAt: number; fromCache: boolean };

export async function cachedRequest<T>(path: string, kind: CacheKind, entityId: number, token: string): Promise<Synced<T>> {
  const userId = await getSessionUserId();
  try {
    const data = await authenticatedRequest<T>(path, { token });
    const syncedAt = Date.now();
    if (userId) await cacheSet(userId, kind, entityId, { data, syncedAt }).catch(() => undefined);
    return { data, syncedAt, fromCache: false };
  } catch (reason) {
    if (reason instanceof ApiError && !isRetriableError(reason)) throw reason;
    const cached = userId ? await cacheGet<{ data: T; syncedAt: number }>(userId, kind, entityId).catch(() => null) : null;
    if (!cached) throw reason;
    return { ...cached, fromCache: true };
  }
}
