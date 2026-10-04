/**
 * Cuentas de las descargas (0.4.0). Módulo puro: videos y material de apoyo
 * comparten un solo manifiesto, una cuota, la caducidad y "solo Wi-Fi".
 */

export type DownloadKind = 'video' | 'resource';

export type DownloadRecord = {
  lessonId: number;
  sourceUrl: string;
  localUri: string;
  size: number;
  downloadedAt: number;
  lastAccessedAt: number;
  /** 0.3.0: para la lista de descargas. */
  title?: string;
  thumbnailUrl?: string;
  /** 0.4.0. Registros de 0.3.x sin `kind` son videos. */
  kind?: DownloadKind;
  courseId?: number;
  /** Recurso: `lessonId:file_id` o `lessonId:url`. */
  resourceKey?: string;
  mime?: string;
  /** `updated_at` del servidor cuando se descargó. */
  serverUpdatedAt?: string | null;
  /** El servidor tiene una versión más nueva que no se bajó sola. */
  updateAvailable?: boolean;
  /** 0.4.1: video de la lección (`videos[].key`). Sin clave = primer video (descargas de 0.4.0). */
  videoKey?: string;
};

export type DownloadSettings = {
  wifiOnly: boolean;
  lowDataMode: boolean;
  maxBytes: number;
  retentionDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const AUTO_UPDATE_MAX_BYTES = 5 * 1024 * 1024;

export const kindOf = (record: DownloadRecord): DownloadKind => record.kind ?? 'video';

/** Caducidad y cuota: primero lo vencido, después lo menos usado hasta entrar en la cuota. */
export function planMaintenance(
  records: DownloadRecord[],
  settings: DownloadSettings,
  now: number,
): { keep: DownloadRecord[]; evict: DownloadRecord[] } {
  const evict: DownloadRecord[] = [];
  const alive = records.filter((record) => {
    const expired = now - record.lastAccessedAt > settings.retentionDays * DAY_MS;
    if (expired) evict.push(record);
    return !expired;
  });
  const keep = [...alive].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  let total = keep.reduce((sum, record) => sum + record.size, 0);
  while (total > settings.maxBytes && keep.length > 0) {
    const oldest = keep.shift()!;
    evict.push(oldest);
    total -= oldest.size;
  }
  return { keep, evict };
}

export type LessonUsage = { lessonId: number; title: string; bytes: number; items: DownloadRecord[] };
export type CourseUsage = { courseId: number; bytes: number; lessons: LessonUsage[] };

/** Uso agrupado por curso y lección (curso 0: descargas de 0.3.x sin curso conocido). */
export function summarize(records: DownloadRecord[]): { usedBytes: number; courses: CourseUsage[] } {
  const courses = new Map<number, Map<number, LessonUsage>>();
  for (const record of records) {
    const courseId = record.courseId ?? 0;
    const lessons = courses.get(courseId) ?? new Map<number, LessonUsage>();
    const lesson = lessons.get(record.lessonId) ?? { lessonId: record.lessonId, title: '', bytes: 0, items: [] };
    lesson.bytes += record.size;
    lesson.items.push(record);
    if (!lesson.title && kindOf(record) === 'video' && record.title) lesson.title = record.title;
    lessons.set(record.lessonId, lesson);
    courses.set(courseId, lessons);
  }
  const result: CourseUsage[] = [...courses.entries()].map(([courseId, lessons]) => {
    const list = [...lessons.values()];
    return { courseId, bytes: list.reduce((sum, lesson) => sum + lesson.bytes, 0), lessons: list };
  });
  return { usedBytes: records.reduce((sum, record) => sum + record.size, 0), courses: result.sort((a, b) => b.bytes - a.bytes) };
}

/** Un recurso ya descargado que cambió en el servidor se baja solo si es liviano y la red lo permite. */
export function shouldAutoUpdate(bytes: number | null | undefined, onWifi: boolean, settings: Pick<DownloadSettings, 'wifiOnly'>): boolean {
  if (bytes === null || bytes === undefined || bytes <= 0 || bytes >= AUTO_UPDATE_MAX_BYTES) return false;
  return onWifi || !settings.wifiOnly;
}

export function resourceKey(lessonId: number, resource: { file_id?: number; url: string }): string {
  return `${lessonId}:${resource.file_id ? `f${resource.file_id}` : resource.url}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 0.4.1: ¿este registro es el video `key` de la lección? Un registro de video
 * sin clave (0.4.0) pertenece al primer video. Descargar un video solo
 * reemplaza su propio registro, nunca el de otro video de la misma lección.
 */
export function isSameVideo(record: DownloadRecord, lessonId: number, key: string, isFirst: boolean): boolean {
  if (kindOf(record) !== 'video' || record.lessonId !== lessonId) return false;
  return record.videoKey ? record.videoKey === key : isFirst;
}
