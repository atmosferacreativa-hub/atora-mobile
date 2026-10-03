import { getDb } from './db';
import type { CacheKind } from './outbox/migration';

export type { CacheKind };

export async function cacheGet<T>(userId: number, kind: CacheKind, entityId = 0): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM cache WHERE user_id = ? AND kind = ? AND entity_id = ?',
    userId, kind, entityId,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(userId: number, kind: CacheKind, entityId: number, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO cache (user_id, kind, entity_id, payload, updated_at) VALUES (?, ?, ?, ?, ?)',
    userId, kind, entityId, JSON.stringify(value), Date.now(),
  );
}
