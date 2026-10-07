import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ApiError, apiRequest, isRetriableError } from './client';
import { purgeLocalDb } from '../offline/db';
import { cacheGet, cacheSet } from '../offline/localCache';
import { purgeOutboxFiles } from '../offline/outboxFiles';
import { purgeLocalThumbnails } from '../offline/thumbnailFiles';
import { performLogout, revokePending } from './logoutFlow';
import { clearConversations } from '../ai/conversation';
import type { LoginResponse, MobileSession, StudentHome } from '../types';

const SESSION_KEY = 'atora.mobile.session.v1';
// Fuera de los prefijos que se purgan al cerrar sesión: tiene que sobrevivir hasta el próximo inicio con red.
const PENDING_REVOKE_KEY = 'atora.mobile.revoke-pending.v1';
const MAX_PENDING_REVOKE = 10;
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
  // 0.9.0: la conversación con el asistente solo vive en la sesión.
  clearConversations();
  // Base local (cachés y cola): no queda nada del usuario anterior.
  await purgeLocalDb().catch(() => undefined);
  // Archivos locales del usuario: un fallo en uno no debe impedir el resto ni el cierre de sesión.
  for (const purge of [purgeOutboxFiles, purgeLocalThumbnails]) {
    try {
      purge();
    } catch {
      // Sin archivos o sin permiso.
    }
  }
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
  // Hay conexión: se revocan las sesiones que quedaron abiertas por un cierre sin red.
  void revokePendingSessions().catch(() => undefined);
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
  const userId = await getSessionUserId();
  const save = async (data: StudentHome) => {
    if (userId) await cacheSet(userId, 'dashboard', 0, data).catch(() => undefined);
  };
  try {
    const data = await apiRequest<StudentHome>('dashboard', { token });
    await save(data);
    return data;
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const data = await apiRequest<StudentHome>('dashboard', { token: refreshed });
        await save(data);
        return data;
      }
    }
    if (reason instanceof ApiError && !isRetriableError(reason)) throw reason;
    const cached = userId ? await cacheGet<StudentHome>(userId, 'dashboard', 0).catch(() => null) : null;
    if (!cached) throw reason;
    return cached;
  }
}

const revokeToken = async (token: string) => {
  await apiRequest<{ revoked: boolean }>('auth/logout', { method: 'POST', token });
};
const tokenAlreadyInvalid = (reason: unknown) => reason instanceof ApiError && (reason.status === 401 || reason.status === 403);

async function readPendingRevocations(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(PENDING_REVOKE_KEY);
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

async function writePendingRevocations(tokens: string[]): Promise<void> {
  if (!tokens.length) await AsyncStorage.removeItem(PENDING_REVOKE_KEY);
  else await AsyncStorage.setItem(PENDING_REVOKE_KEY, JSON.stringify(tokens.slice(-MAX_PENDING_REVOKE)));
}

/**
 * 0.4.1: nunca lanza. La revocación en el servidor es "mejor esfuerzo"; sin red,
 * la sesión local se borra igual y el token se revoca en el próximo inicio de sesión.
 */
export async function logout(token: string): Promise<void> {
  await performLogout(token, {
    revoke: revokeToken,
    alreadyInvalid: tokenAlreadyInvalid,
    clearLocal: clearSession,
    rememberForLater: async (pending) => writePendingRevocations([...await readPendingRevocations(), pending]),
  });
}

/** Revoca los tokens que quedaron pendientes por un cierre de sesión sin red. */
export function revokePendingSessions(): Promise<number> {
  return revokePending({
    list: readPendingRevocations,
    save: writePendingRevocations,
    revoke: revokeToken,
    alreadyInvalid: tokenAlreadyInvalid,
  });
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
