import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { authenticatedRequest } from './authenticated';
import { getServerCapabilities } from './discovery';
import { getSessionUserId } from './session';
import { cacheDelete, cacheGet, cacheSet } from '../offline/localCache';
import type { NotificationPreferences } from '../types';

/**
 * Notificaciones al teléfono (0.6.0, plugin 6.30.0).
 *
 * El permiso se pide solo después de explicar para qué (pantalla Yo o el
 * buzón), nunca al abrir la app por primera vez. Sin permiso, la app funciona
 * igual: sincroniza al abrir y al volver a primer plano. El aviso trae solo
 * ids; la app abre la pantalla correcta (notifications/route.ts).
 */
type DeviceRecord = { id: number; token: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function pushSupported(): Promise<boolean> {
  return Device.isDevice && Boolean((await getServerCapabilities()).push_notifications);
}

export async function permissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

async function savedDevice(): Promise<DeviceRecord | null> {
  const userId = await getSessionUserId();
  return userId ? cacheGet<DeviceRecord>(userId, 'push', 0).catch(() => null) : null;
}

/** Pide permiso (tras la explicación) y registra el dispositivo en la academia. */
export async function enablePush(token: string): Promise<'enabled' | 'denied' | 'unsupported'> {
  if (!(await pushSupported())) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'ATORA', importance: Notifications.AndroidImportance.DEFAULT });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  await registerDevice(token);
  return 'enabled';
}

/** Si ya hay permiso, (re)registra el token: puede cambiar con el tiempo. */
export async function registerDevice(token: string): Promise<void> {
  if (!(await pushSupported()) || (await permissionStatus()) !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const expoToken = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  const { id } = await authenticatedRequest<{ id: number }>('devices', {
    method: 'POST',
    token,
    body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
  });
  const userId = await getSessionUserId();
  if (userId) await cacheSet(userId, 'push', 0, { id, token: expoToken }).catch(() => undefined);
}

/** Al cerrar sesión: el servidor deja de enviar a este teléfono. Mejor esfuerzo. */
export async function unregisterDevice(token: string): Promise<void> {
  const device = await savedDevice();
  if (!device) return;
  await authenticatedRequest(`devices/${device.id}`, { method: 'DELETE', token }).catch(() => undefined);
  const userId = await getSessionUserId();
  if (userId) await cacheDelete(userId, 'push', 0).catch(() => undefined);
}

export async function fetchPreferences(token: string): Promise<NotificationPreferences> {
  const { preferences } = await authenticatedRequest<{ preferences: NotificationPreferences }>('notification-preferences', { token });
  return preferences;
}

export async function savePreferences(token: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const response = await authenticatedRequest<{ preferences: NotificationPreferences }>('notification-preferences', {
    method: 'PUT',
    token,
    body: JSON.stringify({ preferences }),
  });
  return response.preferences;
}
