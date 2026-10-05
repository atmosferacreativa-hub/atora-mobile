import { authenticatedRequest } from './authenticated';
import { getSessionUserId } from './session';
import { cacheGet, cacheSet } from '../offline/localCache';
import { offlineAgenda, type CachedAgenda } from '../agenda/agenda';
import type { AgendaResponse } from '../types';

/**
 * Agenda (0.6.0, plugin 6.30.0). Con conexión pide el rango; sin conexión
 * muestra lo último sincronizado que lo cubre, con su fecha.
 */
const KEEP = 6;

export async function fetchAgenda(from: string, to: string, token: string): Promise<{ data: CachedAgenda; fromCache: boolean }> {
  const userId = await getSessionUserId();
  const stored = userId ? ((await cacheGet<CachedAgenda[]>(userId, 'agenda', 0).catch(() => null)) ?? []) : [];
  try {
    const response = await authenticatedRequest<AgendaResponse>(`agenda?from=${from}&to=${to}`, { token });
    const entry: CachedAgenda = { from, to, items: response.items, syncedAt: Date.now() };
    if (userId) {
      const others = stored.filter((item) => !(item.from === from && item.to === to));
      await cacheSet(userId, 'agenda', 0, [entry, ...others].slice(0, KEEP)).catch(() => undefined);
    }
    return { data: entry, fromCache: false };
  } catch (reason) {
    const cached = offlineAgenda(stored, from, to);
    if (!cached) throw reason;
    return { data: cached, fromCache: true };
  }
}
