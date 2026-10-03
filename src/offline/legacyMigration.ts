import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionUserId } from '../api/session';
import { cacheSet } from './localCache';
import { enqueue } from './outbox/engine';
import { legacyCacheEntry, legacyCompletionsToEvents, legacyQueueOwner } from './outbox/migration';
import { sqliteOutboxStore } from './outbox/sqliteStore';

/**
 * Pasa la cola y la caché de 0.2.0 (AsyncStorage) a la base local.
 * Corre al arrancar, antes de restaurar la sesión: la restauración puede
 * purgar el almacenamiento si el token ya no sirve.
 * Cada clave se borra solo después de copiarla; repetirla no duplica.
 */
export async function migrateLegacyStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  if (!keys.some((key) => key.startsWith('atora.queue.') || key.startsWith('atora.cache.'))) return;
  const sessionUserId = await getSessionUserId();

  for (const key of keys) {
    try {
      const queueOwner = legacyQueueOwner(key, sessionUserId);
      if (queueOwner) {
        const raw = await AsyncStorage.getItem(key);
        for (const event of legacyCompletionsToEvents(queueOwner, raw)) {
          await enqueue(sqliteOutboxStore, event, Date.now());
        }
        await AsyncStorage.removeItem(key);
        continue;
      }
      const entry = legacyCacheEntry(key, sessionUserId);
      if (entry) {
        const raw = await AsyncStorage.getItem(key);
        if (raw) await cacheSet(entry.userId, entry.kind, entry.entityId, JSON.parse(raw));
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Se reintenta en el próximo arranque; la clave sigue en AsyncStorage.
    }
  }
}
