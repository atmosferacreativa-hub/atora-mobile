import type { DownloadRecord } from './mediaDownloads';
import type { LessonResource } from '../types';

export type ResourcePressAction = 'open_local' | 'open_url' | 'show_error' | 'noop';

export function resolveResourcePressAction(
  resource: LessonResource,
  saved: DownloadRecord | undefined,
): ResourcePressAction {
  if (saved?.error) return 'show_error';
  if (saved) return 'open_local';
  const target = resource.download_url || resource.url;
  return target ? 'open_url' : 'noop';
}

export function isUsableSavedDownload(saved: DownloadRecord | undefined): boolean {
  return Boolean(saved && !saved.error);
}

