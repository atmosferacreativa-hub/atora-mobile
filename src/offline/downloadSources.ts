import Constants from 'expo-constants';

function isE2E(): boolean {
  return Boolean((Constants.expoConfig?.extra as { e2e?: boolean } | undefined)?.e2e);
}

/**
 * HTTP solo se permite en desarrollo o en CI e2e hacia localhost.
 *
 * - Producción/preview: solo HTTPS.
 * - E2E: permite `http://127.0.0.1` / `http://localhost` (el workflow usa adb reverse).
 */
export function isAllowedDownloadSource(sourceUrl: string): boolean {
  if (sourceUrl.startsWith('https://')) return true;
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev && sourceUrl.startsWith('http://')) return true;
  if (isE2E()) {
    return sourceUrl.startsWith('http://127.0.0.1') || sourceUrl.startsWith('http://localhost');
  }
  return false;
}

