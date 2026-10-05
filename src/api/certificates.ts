import * as FileSystem from 'expo-file-system/legacy';
import { ApiError, isRetriableError } from './client';
import { authenticatedRequest } from './authenticated';
import { getSessionUserId, refreshAccessToken } from './session';
import { cacheGet, cacheSet } from '../offline/localCache';
import type { CertificateItem } from '../types';

/**
 * Certificados (0.5.0, plugin 6.29.0). Provisional: el servidor entrega el
 * certificado en HTML por un enlace firmado de 15 minutos que además exige el
 * token del mismo usuario. Se guarda en el almacenamiento privado y se abre
 * después sin conexión.
 */
const DIR = `${FileSystem.documentDirectory}atora-certificates/`;

export type StoredCertificate = CertificateItem & { localUri?: string; downloadedAt?: number };

const key = (item: Pick<CertificateItem, 'type' | 'id'>) => `${item.type}-${item.id}`;

async function readLocal(userId: number): Promise<Record<string, StoredCertificate>> {
  return (await cacheGet<Record<string, StoredCertificate>>(userId, 'certificates', 0).catch(() => null)) ?? {};
}

async function writeLocal(userId: number, items: Record<string, StoredCertificate>): Promise<void> {
  await cacheSet(userId, 'certificates', 0, items);
}

/** Lista del servidor combinada con lo ya descargado; sin conexión, solo lo guardado. */
export async function listCertificates(token: string): Promise<{ items: StoredCertificate[]; fromCache: boolean }> {
  const userId = await getSessionUserId();
  const local = userId ? await readLocal(userId) : {};
  try {
    const { certificates } = await authenticatedRequest<{ certificates: CertificateItem[] }>('certificates', { token });
    const merged: Record<string, StoredCertificate> = {};
    for (const item of certificates) {
      const before = local[key(item)];
      merged[key(item)] = { ...item, localUri: item.status === 'revoked' ? undefined : before?.localUri, downloadedAt: before?.downloadedAt };
    }
    if (userId) await writeLocal(userId, merged).catch(() => undefined);
    return { items: Object.values(merged), fromCache: false };
  } catch (reason) {
    if (reason instanceof ApiError && !isRetriableError(reason)) throw reason;
    return { items: Object.values(local), fromCache: true };
  }
}

/** Descarga el documento al almacenamiento privado (enlace firmado + token del usuario). */
export async function downloadCertificate(item: StoredCertificate, token: string): Promise<StoredCertificate> {
  const userId = await getSessionUserId();
  if (!userId || !item.download_url) throw new Error('Este certificado no se puede descargar.');
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  const destination = `${DIR}${key(item)}.html`;
  let result = await FileSystem.downloadAsync(item.download_url, destination, { headers: { Authorization: `Bearer ${token}` } });
  if (result.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) result = await FileSystem.downloadAsync(item.download_url, destination, { headers: { Authorization: `Bearer ${refreshed}` } });
  }
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw new Error(result.status === 403 ? 'El enlace venció o no corresponde a tu cuenta. Actualiza la lista e inténtalo otra vez.' : 'No se pudo descargar el certificado.');
  }
  const saved: StoredCertificate = { ...item, localUri: result.uri, downloadedAt: Date.now() };
  const local = await readLocal(userId);
  await writeLocal(userId, { ...local, [key(item)]: saved });
  return saved;
}

/** Al cerrar sesión: los certificados guardados no quedan para la próxima cuenta. */
export async function purgeCertificateFiles(): Promise<void> {
  await FileSystem.deleteAsync(DIR, { idempotent: true });
}
