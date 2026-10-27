import type { DownloadRecord } from './mediaDownloads';
import { downloadResource } from './mediaDownloads';
import type { LessonDetail, LessonResource } from '../types';
import { t } from '../i18n/core';
import { viewerKind } from '../viewer/files';

export type OpenResourceParams = { title: string; localUri: string; kind: 'pdf' | 'image'; mime?: string };

function isWifiOnlyRestriction(message: string): boolean {
  return message.trim() === t('Las descargas están limitadas a Wi-Fi.');
}

function isStorageRestriction(message: string): boolean {
  return message.trim() === t('No hay espacio disponible dentro del límite configurado.');
}

async function openOnlineResource(params: {
  resource: LessonResource;
  title: string;
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
  params.onOpenResource({ title: params.title, localUri: target, kind, mime: params.resource.mime });
}

export async function downloadAndOpenResourceOrOpenOnline(params: {
  lesson: Pick<LessonDetail, 'id' | 'course_id'>;
  resource: LessonResource;
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
    const message = reason instanceof Error ? reason.message : t('No fue posible descargar el material.');
    if (isWifiOnlyRestriction(message)) {
      params.setNotice(t('Para guardarlo sin conexión, conéctate a Wi-Fi.'));
      await openOnlineResource({
        resource: params.resource,
        title: params.resource.title,
        onOpenResource: params.onOpenResource,
        openUrl: params.openUrl,
      });
      return;
    }

    if (isStorageRestriction(message)) {
      params.setNotice(t('Para guardarlo sin conexión, libera espacio o aumenta el límite.'));
      await openOnlineResource({
        resource: params.resource,
        title: params.resource.title,
        onOpenResource: params.onOpenResource,
        openUrl: params.openUrl,
      });
      return;
    }

    params.setNotice(message);
  }
}

