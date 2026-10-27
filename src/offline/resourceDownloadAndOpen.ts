import type { DownloadRecord } from './mediaDownloads';
import { downloadResource } from './mediaDownloads';
import type { LessonDetail, LessonResource } from '../types';
import { t } from '../i18n/core';
import { viewerKind } from '../viewer/files';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { config } from '../config';
import { getApiBaseUrlSync } from '../runtimeConfig';
import { DownloadBlockedError, isDownloadBlockedError } from './downloadErrors';
import { isAllowedDownloadSource } from './downloadSources';
import { ONLINE_CACHE_DIR } from './onlineCache';

export type OpenResourceParams = { title: string; localUri: string; kind: 'pdf' | 'image'; mime?: string };

function safeExtension(sourceUrl: string, fallback = '.bin'): string {
  const raw = sourceUrl.split('?')[0] || '';
  const match = raw.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? `.${match[1]!.toLowerCase()}` : fallback;
}

function parseUrl(input: string): { origin: string; pathname: string } | null {
  try {
    // eslint-disable-next-line no-new
    const ref = new URL(input);
    return { origin: ref.origin, pathname: ref.pathname || '/' };
  } catch {
    const match = input.match(/^(https?:)\/\/([^/]+)(\/[^?#]*)?/i);
    if (!match) return null;
    return { origin: `${match[1]!.toLowerCase()}//${match[2]!}`, pathname: match[3] || '/' };
  }
}

function authHeadersForUrl(url: string, token?: string): Record<string, string> {
  if (!token) return {};
  const apiBaseUrl = getApiBaseUrlSync() || config.apiBaseUrl;
  if (!apiBaseUrl) return {};
  const base = parseUrl(apiBaseUrl);
  const target = parseUrl(url);
  if (!base || !target) return {};
  if (target.origin !== base.origin) return {};
  const prefix = `${base.pathname.replace(/\/+$/, '')}/`;
  return target.pathname.startsWith(prefix) ? { Authorization: `Bearer ${token}` } : {};
}

async function openOnlineResource(params: {
  resource: LessonResource;
  title: string;
  token?: string;
  onOpenResource: (params: OpenResourceParams) => void;
  openUrl: (url: string) => Promise<void>;
}): Promise<void> {
  const target = params.resource.download_url || params.resource.url;
  if (!target) return;
  const kind = viewerKind(params.resource.mime, target);
  if (kind === 'system') {
    await params.openUrl(target);
    return;
  }
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false) {
    throw new Error(t('Este material solo está disponible con conexión.'));
  }
  if (!isAllowedDownloadSource(target)) {
    throw new Error(t('Solo se permiten descargas protegidas por HTTPS.'));
  }

  await FileSystem.makeDirectoryAsync(ONLINE_CACHE_DIR, { intermediates: true });
  const destination = `${ONLINE_CACHE_DIR}res-${Date.now()}${safeExtension(target, kind === 'pdf' ? '.pdf' : '.bin')}`;
  const result = await FileSystem.downloadAsync(target, destination, {
    headers: authHeadersForUrl(target, params.token),
  });
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error(t('El servidor no entregó el archivo.'));
  }
  params.onOpenResource({ title: params.title, localUri: result.uri, kind, mime: params.resource.mime });
}

export async function downloadAndOpenResourceOrOpenOnline(params: {
  lesson: Pick<LessonDetail, 'id' | 'course_id'>;
  resource: LessonResource;
  token?: string;
  loadSavedResources: (lessonId: number) => Promise<void>;
  openLocal: (record: DownloadRecord, title: string) => Promise<void>;
  onOpenResource: (params: OpenResourceParams) => void;
  openUrl: (url: string) => Promise<void>;
  setNotice: (text: string) => void;
  download?: typeof downloadResource;
}): Promise<void> {
  const runDownload = params.download ?? downloadResource;
  try {
    const downloaded = await runDownload(params.lesson, params.resource);
    await params.loadSavedResources(params.lesson.id);
    await params.openLocal(downloaded, params.resource.title);
    return;
  } catch (reason) {
    if (isDownloadBlockedError(reason)) {
      const blocked = reason as DownloadBlockedError;
      if (blocked.code === 'wifi_only') {
        params.setNotice(t('Para guardarlo sin conexión, conéctate a Wi-Fi.'));
      } else {
        params.setNotice(t('Para guardarlo sin conexión, libera espacio o aumenta el límite.'));
      }
      try {
        await openOnlineResource({
          resource: params.resource,
          title: params.resource.title,
          token: params.token,
          onOpenResource: params.onOpenResource,
          openUrl: params.openUrl,
        });
      } catch (fallbackReason) {
        const fallbackMessage = fallbackReason instanceof Error ? fallbackReason.message : t('No fue posible abrir el material en línea.');
        params.setNotice(fallbackMessage);
      }
      return;
    }

    const message = reason instanceof Error ? reason.message : t('No fue posible descargar el material.');
    params.setNotice(message);
  }
}

