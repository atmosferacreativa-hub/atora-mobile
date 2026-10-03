import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './client';
import { getApiBaseUrlSync } from '../runtimeConfig';
import type { ServerCapabilities } from '../types';

// Capacidades del servidor, no del usuario: se guardan por URL de la academia y sobreviven al cierre de sesión.
const key = () => `atora.server.capabilities.v1:${getApiBaseUrlSync()}`;

let memory: ServerCapabilities | null = null;

/** Consulta /discovery; sin conexión usa lo último conocido. Servidores anteriores a 6.27.0 no declaran `assignments`. */
export async function loadServerCapabilities(): Promise<ServerCapabilities> {
  try {
    const data = await apiRequest<{ capabilities?: ServerCapabilities }>('discovery');
    memory = data.capabilities ?? {};
    await AsyncStorage.setItem(key(), JSON.stringify(memory)).catch(() => undefined);
  } catch {
    if (!memory) {
      const raw = await AsyncStorage.getItem(key()).catch(() => null);
      memory = raw ? (JSON.parse(raw) as ServerCapabilities) : {};
    }
  }
  return memory;
}

export async function getServerCapabilities(): Promise<ServerCapabilities> {
  return memory ?? loadServerCapabilities();
}
