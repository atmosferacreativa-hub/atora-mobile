import AsyncStorage from '@react-native-async-storage/async-storage';
import { config as buildConfig, defaultApiBaseUrl } from './config';

const API_URL_KEY = 'atora.mobile.apiBaseUrl.v1';

let cachedApiBaseUrl: string = defaultApiBaseUrl;

export function getApiBaseUrlSync(): string {
  return cachedApiBaseUrl;
}

export function getSiteBaseUrlSync(): string {
  const api = cachedApiBaseUrl;
  if (!api) return '';
  return api.replace(/\/wp-json\/[^/]+\/v1$/i, '');
}

export async function initRuntimeConfig(): Promise<void> {
  const stored = await AsyncStorage.getItem(API_URL_KEY);
  if (stored) {
    // Migración suave: si alguien guardó el endpoint anterior `/wp-json/atora/v1`,
    // intentamos pasar a `/wp-json/atora-mobile/v1` (es el que usa la app).
    if (/\/wp-json\/atora\/v1$/i.test(stored)) {
      const migrated = stored.replace(/\/wp-json\/atora\/v1$/i, '/wp-json/atora-mobile/v1');
      cachedApiBaseUrl = migrated;
      buildConfig.apiBaseUrl = migrated;
      await AsyncStorage.setItem(API_URL_KEY, migrated);
      return;
    }
    cachedApiBaseUrl = stored;
    buildConfig.apiBaseUrl = stored;
    return;
  }
  buildConfig.apiBaseUrl = cachedApiBaseUrl;
}

export function normalizeApiBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/$/, '');
  if (!trimmed) return '';

  if (/\/wp-json\/atora-mobile\/v1$/i.test(trimmed)) return trimmed;
  if (/\/wp-json\/atora\/v1$/i.test(trimmed)) return trimmed;

  if (/^https?:\/\/.+/i.test(trimmed)) {
    return `${trimmed}/wp-json/atora-mobile/v1`;
  }

  return trimmed;
}

export async function setApiBaseUrl(next: string): Promise<void> {
  const normalized = normalizeApiBaseUrl(next);
  cachedApiBaseUrl = normalized;
  buildConfig.apiBaseUrl = normalized;

  if (normalized) {
    await AsyncStorage.setItem(API_URL_KEY, normalized);
  } else {
    await AsyncStorage.removeItem(API_URL_KEY);
  }
}
