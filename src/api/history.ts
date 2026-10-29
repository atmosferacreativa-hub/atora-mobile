import * as FileSystem from 'expo-file-system/legacy';
import { authenticatedRequest } from './authenticated';
import { refreshAccessToken } from './session';
import { t } from '../i18n/core';

/**
 * Historial académico (1.4.0, plugin 6.41.0): el servidor da un enlace firmado de 15 minutos que además exige el token
 * del mismo usuario. El PDF se guarda en una carpeta privada (se borra al cerrar sesión) y se abre en el visor.
 */
const DIR = `${FileSystem.documentDirectory}atora-history/`;

type HistoryResponse = { document_url: string };

export async function downloadHistory(token: string): Promise<string> {
  const { document_url: url } = await authenticatedRequest<HistoryResponse>('me/history', { token });
  if (!url) throw new Error(t('No se pudo descargar el historial.'));
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  const destination = `${DIR}historial-${Date.now()}.pdf`;
  let result = await FileSystem.downloadAsync(url, destination, { headers: { Authorization: `Bearer ${token}` } });
  if (result.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) result = await FileSystem.downloadAsync(url, destination, { headers: { Authorization: `Bearer ${refreshed}` } });
  }
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw new Error(t('No se pudo descargar el historial.'));
  }
  // Solo la versión más reciente.
  const files = await FileSystem.readDirectoryAsync(DIR).catch(() => [] as string[]);
  await Promise.all(files.filter((name) => `${DIR}${name}` !== result.uri).map((name) => FileSystem.deleteAsync(`${DIR}${name}`, { idempotent: true })));
  return result.uri;
}
