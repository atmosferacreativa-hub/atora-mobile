import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './client';
import { getApiBaseUrlSync } from '../runtimeConfig';
import type { ServerCapabilities } from '../types';

// Capacidades del servidor, no del usuario: se guardan por URL de la academia y sobreviven al cierre de sesión.
const key = (url: string) => `atora.server.capabilities.v1:${url}`;

// 0.4.0: la memoria va atada a la URL. Antes, si la primera consulta fallaba
// (p. ej. academia aún sin configurar), quedaba `{}` hasta reiniciar la app y
// se ocultaban funciones que el servidor sí declara.
let memory: { url: string; caps: ServerCapabilities; fresh: boolean } | null = null;

/** Consulta /discovery; sin conexión usa lo último conocido. Servidores anteriores a 6.27.0 no declaran `assignments`. */
export async function loadServerCapabilities(): Promise<ServerCapabilities> {
  const url = getApiBaseUrlSync();
  try {
    const data = await apiRequest<{ capabilities?: ServerCapabilities }>('discovery');
    memory = { url, caps: data.capabilities ?? {}, fresh: true };
    await AsyncStorage.setItem(key(url), JSON.stringify(memory.caps)).catch(() => undefined);
    return memory.caps;
  } catch {
    if (memory?.url === url) return memory.caps;
    const raw = await AsyncStorage.getItem(key(url)).catch(() => null);
    // Lo guardado sirve sin conexión, pero no se marca como fresco: se vuelve a consultar.
    const caps = raw ? (JSON.parse(raw) as ServerCapabilities) : {};
    memory = { url, caps, fresh: false };
    return caps;
  }
}

export async function getServerCapabilities(): Promise<ServerCapabilities> {
  if (memory && memory.url === getApiBaseUrlSync() && memory.fresh) return memory.caps;
  return loadServerCapabilities();
}
