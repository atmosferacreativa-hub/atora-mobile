import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ApiError, apiRequest, isRetriableError } from './client';
import type { LoginResponse, MobileSession, StudentHome } from '../types';

const SESSION_KEY = 'atora.mobile.session.v1';
const LEGACY_DASHBOARD_CACHE = 'atora.cache.dashboard.v1';
const CACHE_PREFIX = 'atora.cache.';
const QUEUE_PREFIX = 'atora.queue.';

type StoredSession = MobileSession & {
  user_id: number;
  access_expires_at: number;
  refresh_expires_at: number;
};

function withExpirations(session: MobileSession, userId: number): StoredSession {
  const now = Date.now();
  return {
    ...session,
    user_id: userId,
    access_expires_at: now + session.expires_in * 1000,
    refresh_expires_at: now + session.refresh_expires_in * 1000,
  };
}

async function clearAppCaches(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  if (!keys.length) return;
  const toRemove = keys.filter((key) => key.startsWith(CACHE_PREFIX) || key.startsWith(QUEUE_PREFIX));
  if (!toRemove.length) return;
  await AsyncStorage.multiRemove(toRemove);
}

export async function getSessionUserId(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredSession>;
    return typeof stored.user_id === 'number' && stored.user_id > 0 ? stored.user_id : null;
  } catch {
    return null;
  }
}

async function getDashboardCacheKey(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) return LEGACY_DASHBOARD_CACHE;
  return `atora.cache.u${userId}.dashboard.v1`;
}

async function persist(session: StoredSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify(session),
      Platform.OS === 'ios'
        ? { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
        : undefined,
    );
  } catch {
    throw new ApiError(
      'Tus datos fueron aceptados, pero Android no pudo guardar la sesión segura. Reinicia Expo Go e inténtalo otra vez.',
      0,
      'secure_storage_error',
    );
  }
}

export async function login(
  loginValue: string,
  password: string,
  deviceName = 'ATORA Mobile',
): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>('auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginValue, password, device_name: deviceName }),
  });
  await clearAppCaches();
  await persist(withExpirations(response.session, response.user.id));
  return response;
}

export async function restoreAccessToken(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  let stored: StoredSession;
  try {
    stored = JSON.parse(raw) as StoredSession;
  } catch {
    await clearSession();
    return null;
  }

  if (typeof stored.user_id !== 'number' || stored.user_id <= 0) {
    await clearSession();
    return null;
  }

  if (stored.refresh_expires_at <= Date.now()) {
    await clearSession();
    return null;
  }

  if (stored.access_expires_at > Date.now() + 30_000) {
    return stored.access_token;
  }

  try {
    const response = await apiRequest<{ session: MobileSession }>('auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: stored.refresh_token }),
    });
    const rotated = withExpirations(response.session, stored.user_id);
    await persist(rotated);
    return rotated.access_token;
  } catch (reason) {
    // Sin red/5xx: conservamos sesión local para que la app use caché.
    if (isRetriableError(reason)) return stored.access_token;
    await clearSession();
    return null;
  }
}

export async function loadDashboard(token: string): Promise<StudentHome> {
  const cacheKey = await getDashboardCacheKey();
  try {
    const data = await apiRequest<StudentHome>('dashboard', { token });
    await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const data = await apiRequest<StudentHome>('dashboard', { token: refreshed });
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      }
    }
    if (reason instanceof ApiError && !isRetriableError(reason)) throw reason;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (!cached) throw reason;
    return JSON.parse(cached) as StudentHome;
  }
}

export async function logout(token: string): Promise<void> {
  try {
    await apiRequest<{ revoked: boolean }>('auth/logout', { method: 'POST', token });
  } finally {
    await clearSession();
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSession;
    if (typeof stored.user_id !== 'number' || stored.user_id <= 0) {
      await clearSession();
      return null;
    }
    if (stored.refresh_expires_at <= Date.now()) {
      await clearSession();
      return null;
    }
    const response = await apiRequest<{ session: MobileSession }>('auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: stored.refresh_token }),
    });
    const rotated = withExpirations(response.session, stored.user_id);
    await persist(rotated);
    return rotated.access_token;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await clearAppCaches();
}

let refreshInFlight: Promise<string | null> | null = null;
