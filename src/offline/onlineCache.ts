import * as FileSystem from 'expo-file-system/legacy';

export const ONLINE_CACHE_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}atora-online/`;

export function isOnlineCacheUri(uri: string): boolean {
  return Boolean(ONLINE_CACHE_DIR && uri.startsWith(ONLINE_CACHE_DIR));
}

export async function cleanupOnlineCache(): Promise<void> {
  if (!ONLINE_CACHE_DIR) return;
  await FileSystem.deleteAsync(ONLINE_CACHE_DIR, { idempotent: true }).catch(() => undefined);
}

