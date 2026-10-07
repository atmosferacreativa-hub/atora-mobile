import * as FileSystem from 'expo-file-system/legacy';
import { ApiError, isRetriableError } from './client';
import { authenticatedRequest } from './authenticated';
import { getSessionUserId, refreshAccessToken } from './session';
import { cacheGet, cacheSet } from '../offline/localCache';
import type { CertificateItem } from '../types';
import { t } from '../i18n/core';

/**
 * Certificados (0.5.0, plugin 6.29.0). El servidor entrega el certificado
 * por un enlace firmado de 15 minutos que además exige el token del mismo
 * usuario. Se guarda en el almacenamiento privado y se abre después sin conexión.
 * 1.0.0 (plugin 6.33.0, `certificate_pdf`): el PDF institucional, que se abre
 * con el visor de PDF; con servidores anteriores, el HTML provisional.
 */
const DIR = `${FileSystem.documentDirectory}atora-certificates/`;

export type StoredCertificate = CertificateItem & { localUri?: string; downloadedAt?: number; format?: 'pdf' | 'html' };

/** Qué pedir y dónde guardarlo. Módulo puro para Jest. */
export function certificateRequest(downloadUrl: string, pdf: boolean, fileKey: string, dir: string): { url: string; destination: string; format: 'pdf' | 'html' } {
  if (!pdf) return { url: downloadUrl, destination: `${dir}${fileKey}.html`, format: 'html' };
  return { url: `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}format=pdf`, destination: `${dir}${fileKey}.pdf`, format: 'pdf' };
}

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
      merged[key(item)] = { ...item, localUri: item.status === 'revoked' ? undefined : before?.localUri, downloadedAt: before?.downloadedAt, format: before?.format };
    }
    if (userId) await writeLocal(userId, merged).catch(() => undefined);
    return { items: Object.values(merged), fromCache: false };
  } catch (reason) {
    if (reason instanceof ApiError && !isRetriableError(reason)) throw reason;
    return { items: Object.values(local), fromCache: true };
  }
}

/** Descarga el documento al almacenamiento privado (enlace firmado + token del usuario). */
export async function downloadCertificate(item: StoredCertificate, token: string, pdf = false): Promise<StoredCertificate> {
  const userId = await getSessionUserId();
  if (!userId || !item.download_url) throw new Error(t('Este certificado no se puede descargar.'));
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  const { url, destination, format } = certificateRequest(item.download_url, pdf, key(item), DIR);
  let result = await FileSystem.downloadAsync(url, destination, { headers: { Authorization: `Bearer ${token}` } });
  if (result.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) result = await FileSystem.downloadAsync(url, destination, { headers: { Authorization: `Bearer ${refreshed}` } });
  }
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw new Error(result.status === 403 ? t('El enlace venció o no corresponde a tu cuenta. Actualiza la lista e inténtalo otra vez.') : t('No se pudo descargar el certificado.'));
  }
  // La versión anterior (otro formato) ya no hace falta.
  if (item.localUri && item.localUri !== result.uri) await FileSystem.deleteAsync(item.localUri, { idempotent: true }).catch(() => undefined);
  const saved: StoredCertificate = { ...item, localUri: result.uri, downloadedAt: Date.now(), format };
  const local = await readLocal(userId);
  await writeLocal(userId, { ...local, [key(item)]: saved });
  return saved;
}

/** Al cerrar sesión: los certificados guardados no quedan para la próxima cuenta. */
export async function purgeCertificateFiles(): Promise<void> {
  await FileSystem.deleteAsync(DIR, { idempotent: true });
}
