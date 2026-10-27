import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { getSessionUserId } from '../api/session';
import { scormDownloadLink } from '../api/scorm';
import {
  isSameVideo,
  kindOf,
  planMaintenance,
  resourceKey,
  shouldAutoUpdate,
  summarize,
  type CourseUsage,
  type DownloadRecord,
  type DownloadSettings,
} from './downloadsMath';
import type { LessonDetail, LessonResource } from '../types';
import { t } from '../i18n/core';
import { unzipSync } from 'fflate';
import { base64ToBytes, bytesToBase64 } from '../utils/base64';
import { isAllowedDownloadSource } from './downloadSources';
import { DownloadBlockedError } from './downloadErrors';

export type { DownloadRecord, DownloadSettings };

const LEGACY_MANIFEST_KEY = 'atora.offline.media.v1';
const LEGACY_SETTINGS_KEY = 'atora.offline.settings.v1';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}atora-offline/`;

// Las descargas (manifiesto + preferencias) se namespacean por usuario, igual
// que la caché de cursos/lecciones (ver api/session.ts, api/courses.ts): sin
// esto, dos cuentas en el mismo teléfono compartían el panel "contenido
// descargado" y la cuota de almacenamiento del usuario anterior.
async function manifestKey(): Promise<string> {
  const userId = await getSessionUserId();
  return userId ? `atora.offline.u${userId}.media.v1` : LEGACY_MANIFEST_KEY;
}

async function settingsKey(): Promise<string> {
  const userId = await getSessionUserId();
  return userId ? `atora.offline.u${userId}.settings.v1` : LEGACY_SETTINGS_KEY;
}
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024;

export type StorageSummary = {
  count: number;
  usedBytes: number;
  maxBytes: number;
};

const defaults: DownloadSettings = {
  wifiOnly: true,
  lowDataMode: true,
  maxBytes: DEFAULT_MAX_BYTES,
  retentionDays: 30,
};

async function readManifest(): Promise<DownloadRecord[]> {
  const raw = await AsyncStorage.getItem(await manifestKey());
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as DownloadRecord[] : [];
  } catch {
    return [];
  }
}

async function writeManifest(records: DownloadRecord[]): Promise<void> {
  await AsyncStorage.setItem(await manifestKey(), JSON.stringify(records));
}

/** Una sola escritura del manifiesto a la vez: descargas en serie del curso y la sincronización no se pisan. */
let manifestLock: Promise<unknown> = Promise.resolve();
function withManifest<T>(task: () => Promise<T>): Promise<T> {
  const run = manifestLock.then(task, task);
  manifestLock = run.catch(() => undefined);
  return run;
}

export async function getDownloadSettings(): Promise<DownloadSettings> {
  const raw = await AsyncStorage.getItem(await settingsKey());
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) } as DownloadSettings;
  } catch {
    return defaults;
  }
}

export async function updateDownloadSettings(
  values: Partial<DownloadSettings>,
): Promise<DownloadSettings> {
  const settings = { ...await getDownloadSettings(), ...values };
  await AsyncStorage.setItem(await settingsKey(), JSON.stringify(settings));
  await maintainDownloads(settings);
  return settings;
}

/**
 * Purga por completo las descargas (archivos + manifiesto) del usuario que
 * tiene la sesión actual. Se llama desde el flujo de logout (App.tsx) antes
 * de limpiar la sesión, para que la próxima cuenta que inicie sesión en el
 * mismo dispositivo no herede ni vea el contenido descargado de la anterior.
 */
export async function purgeCurrentUserDownloads(): Promise<void> {
  await clearAllDownloads();
}

async function deleteRecordFile(record: DownloadRecord): Promise<void> {
  await FileSystem.deleteAsync(record.localUri, { idempotent: true });
}

async function validRecords(records: DownloadRecord[]): Promise<DownloadRecord[]> {
  const checked = await Promise.all(records.map(async (record) => {
    if (record.error) return record;
    const info = await FileSystem.getInfoAsync(record.localUri);
    return info.exists ? record : null;
  }));
  return checked.filter((record): record is DownloadRecord => record !== null);
}

/** Caducidad y cuota compartidas por videos y material (downloadsMath.planMaintenance). */
export function maintainDownloads(providedSettings?: DownloadSettings): Promise<DownloadRecord[]> {
  return withManifest(async () => {
    const settings = providedSettings ?? await getDownloadSettings();
    const { keep, evict } = planMaintenance(await validRecords(await readManifest()), settings, Date.now());
    await Promise.all(evict.map(deleteRecordFile));
    await writeManifest(keep);
    return keep;
  });
}

async function touch(match: (record: DownloadRecord) => boolean): Promise<DownloadRecord | null> {
  await maintainDownloads();
  return withManifest(async () => {
    const records = await readManifest();
    const index = records.findIndex(match);
    const current = index >= 0 ? records[index] : undefined;
    if (!current) return null;
    const touched = { ...current, lastAccessedAt: Date.now() };
    records[index] = touched;
    await writeManifest(records);
    return touched;
  });
}

export function findLessonDownload(lessonId: number, sourceUrl: string): Promise<DownloadRecord | null> {
  return touch((record) => kindOf(record) === 'video' && record.lessonId === lessonId && record.sourceUrl === sourceUrl);
}

function safeExtension(sourceUrl: string, fallback = '.mp4'): string {
  const match = new URL(sourceUrl).pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? `.${match[1]!.toLowerCase()}` : fallback;
}

const isAllowedSource = isAllowedDownloadSource;

async function assertNetwork(settings: DownloadSettings, allowCellular = false): Promise<void> {
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false) {
    throw new Error(t('Necesitas conexión para descargar.'));
  }
  if (settings.wifiOnly && !allowCellular && network.type !== Network.NetworkStateType.WIFI) {
    throw new DownloadBlockedError('wifi_only', t('Las descargas están limitadas a Wi-Fi.'));
  }
}

async function fetchToManifest(
  sourceUrl: string,
  fileName: string,
  record: Omit<DownloadRecord, 'localUri' | 'size' | 'downloadedAt' | 'lastAccessedAt'>,
  replace: (existing: DownloadRecord) => boolean,
): Promise<DownloadRecord> {
  if (!isAllowedSource(sourceUrl)) {
    throw new Error(t('Solo se permiten descargas protegidas por HTTPS.'));
  }
  await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  let result: Awaited<ReturnType<typeof FileSystem.downloadAsync>>;
  try {
    result = await FileSystem.downloadAsync(sourceUrl, `${DOWNLOAD_DIR}${fileName}`);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    if (/ENOSPC|no space/i.test(message)) {
      throw new DownloadBlockedError('no_space', t('No hay espacio disponible dentro del límite configurado.'));
    }
    throw reason;
  }
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error(t('El servidor no entregó el archivo.'));
  }
  const info = await FileSystem.getInfoAsync(result.uri);
  const now = Date.now();
  const saved: DownloadRecord = {
    ...record,
    localUri: result.uri,
    size: info.exists && 'size' in info ? info.size : 0,
    downloadedAt: now,
    lastAccessedAt: now,
  };
  await withManifest(async () => {
    const records = await readManifest();
    const replaced = records.filter(replace);
    await Promise.all(replaced.map(deleteRecordFile));
    await writeManifest([...records.filter((item) => !replace(item)), saved]);
  });
  const maintained = await maintainDownloads();
  const kept = maintained.find((item) => item.localUri === saved.localUri);
  if (!kept) throw new DownloadBlockedError('quota', t('No hay espacio disponible dentro del límite configurado.'));
  return kept;
}

export async function downloadLessonMedia(
  lessonId: number,
  sourceUrl: string,
  meta: { title?: string; thumbnailUrl?: string; courseId?: number; videoKey?: string; isFirstVideo?: boolean } = {},
): Promise<DownloadRecord> {
  await assertNetwork(await getDownloadSettings());
  const key = meta.videoKey ?? '';
  const isFirst = meta.isFirstVideo ?? true;
  return fetchToManifest(
    sourceUrl,
    `lesson-${lessonId}-${Date.now()}${safeExtension(sourceUrl)}`,
    { lessonId, sourceUrl, kind: 'video', title: meta.title, thumbnailUrl: meta.thumbnailUrl, courseId: meta.courseId, videoKey: meta.videoKey },
    // 0.4.1: solo reemplaza la descarga de este mismo video, no la de los otros de la lección.
    (record) => (key ? isSameVideo(record, lessonId, key, isFirst) : kindOf(record) === 'video' && record.lessonId === lessonId),
  );
}

/** 0.4.1: descarga de un video concreto de la lección (la de 0.4.0 sin clave es del primero). */
export function findVideoDownload(lessonId: number, videoKey: string, isFirst: boolean, sourceUrl: string): Promise<DownloadRecord | null> {
  return touch((record) => isSameVideo(record, lessonId, videoKey, isFirst) && record.sourceUrl === sourceUrl);
}

export function removeVideoDownload(lessonId: number, videoKey: string, isFirst: boolean): Promise<void> {
  return removeDownloads((record) => isSameVideo(record, lessonId, videoKey, isFirst));
}

export async function listVideoDownloads(lessonId: number): Promise<DownloadRecord[]> {
  return (await readManifest()).filter((record) => kindOf(record) === 'video' && record.lessonId === lessonId);
}

/** Material de apoyo (0.4.0): mismo manifiesto, cuota, caducidad y preferencia "solo Wi-Fi" que los videos. */
export async function downloadResource(
  lesson: Pick<LessonDetail, 'id' | 'course_id'>,
  resource: LessonResource,
  options: { allowCellular?: boolean } = {},
): Promise<DownloadRecord> {
  const sourceUrl = resource.download_url || resource.url;
  if (!resource.downloadable || !sourceUrl) throw new Error(t('Este material solo está disponible con conexión.'));
  await assertNetwork(await getDownloadSettings(), options.allowCellular);
  const key = resourceKey(lesson.id, resource);
  return fetchToManifest(
    sourceUrl,
    `res-${lesson.id}-${Date.now()}${safeExtension(sourceUrl, '.bin')}`,
    {
      lessonId: lesson.id,
      courseId: lesson.course_id,
      sourceUrl,
      kind: 'resource',
      resourceKey: key,
      title: resource.title,
      mime: resource.mime,
      serverUpdatedAt: resource.updated_at ?? null,
      updateAvailable: false,
    },
    (record) => record.resourceKey === key,
  );
}

// Hermes (Android) no garantiza `atob`/`btoa`. Implementación base64 pura para
// extraer ZIPs SCORM desde `FileSystem.readAsStringAsync(...Base64)`.

function sanitizeZipPath(entry: string): string {
  const normalized = entry.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) throw new Error(t('El paquete no es válido.'));
  return normalized.replace(/^\//, '');
}

async function unzipScormPackage(zipUri: string, destDir: string): Promise<{ bytes: number; files: number }> {
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  const raw = await FileSystem.readAsStringAsync(zipUri, { encoding: FileSystem.EncodingType.Base64 });
  const entries = unzipSync(base64ToBytes(raw));
  let bytes = 0;
  let files = 0;
  for (const [name, data] of Object.entries(entries)) {
    const safe = sanitizeZipPath(name);
    if (safe.endsWith('/')) {
      await FileSystem.makeDirectoryAsync(`${destDir}${safe}`, { intermediates: true });
      continue;
    }
    const parts = safe.split('/');
    if (parts.length > 1) {
      await FileSystem.makeDirectoryAsync(`${destDir}${parts.slice(0, -1).join('/')}`, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(`${destDir}${safe}`, bytesToBase64(data as Uint8Array), { encoding: FileSystem.EncodingType.Base64 });
    bytes += (data as Uint8Array).length;
    files += 1;
  }
  await FileSystem.writeAsStringAsync(`${destDir}.atora-complete`, '1');
  return { bytes, files };
}

const SCORM_DIR = `${DOWNLOAD_DIR}scorm/`;

/** SCORM (1.1.0): descarga el ZIP, lo descomprime y guarda un registro en el manifiesto. */
export async function downloadScormPackage(
  lesson: Pick<LessonDetail, 'id' | 'course_id'>,
  resource: LessonResource,
  token: string,
  options: { allowCellular?: boolean } = {},
): Promise<DownloadRecord> {
  const libraryItemId = Number(resource.library_item_id ?? 0);
  if (!libraryItemId) throw new Error(t('Este material no está disponible.'));
  await assertNetwork(await getDownloadSettings(), options.allowCellular);

  const link = await scormDownloadLink(token, lesson.id, libraryItemId);
  const sourceUrl = link.download_url;
  if (!sourceUrl) throw new Error(t('El servidor no entregó el archivo.'));
  if (!isAllowedSource(sourceUrl)) throw new Error(t('Solo se permiten descargas protegidas por HTTPS.'));

  await FileSystem.makeDirectoryAsync(SCORM_DIR, { intermediates: true });

  const checksum = link.version_checksum_sha256 || `v${link.library_version_id}`;
  const zipPath = `${SCORM_DIR}pkg-${lesson.id}-${libraryItemId}-${checksum}.zip`;
  // Android: el servidor local usa el nombre de carpeta como token en la ruta.
  // iOS puede abrir file:// directo, pero mantenemos la misma ruta.
  const destDir = `${SCORM_DIR}serve/${checksum}/`;

  const recordKey = `${lesson.id}:scorm:${libraryItemId}:${checksum}`;

  const writeScormError = async (message: string) => {
    const now = Date.now();
    const failed: DownloadRecord = {
      lessonId: lesson.id,
      courseId: lesson.course_id,
      sourceUrl,
      localUri: destDir,
      size: 0,
      downloadedAt: now,
      lastAccessedAt: now,
      kind: 'scorm',
      resourceKey: recordKey,
      title: resource.title,
      mime: 'application/zip',
      serverUpdatedAt: resource.updated_at ?? null,
      updateAvailable: false,
      error: message,
      failedAt: now,
      scorm: {
        libraryItemId,
        libraryVersionId: link.library_version_id,
        checksum,
        launchHref: resource.launch_href || '',
        scormVersion: link.scorm_version,
        attemptId: link.attempt_id,
      },
    };

    await withManifest(async () => {
      const records = await readManifest();
      await writeManifest([...records.filter((item) => item.resourceKey !== recordKey), failed]);
    });
  };

  const result = await FileSystem.downloadAsync(sourceUrl, zipPath, { headers: { Authorization: `Bearer ${token}` } });
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    const message = t('El servidor no entregó el archivo.');
    await writeScormError(message);
    throw new Error(message);
  }

  let extracted: { bytes: number; files: number };
  try {
    // Extraer a carpeta dedicada y marcar completo (si falla, queda sin marcar).
    extracted = await unzipScormPackage(result.uri, destDir);
  } catch {
    const message = t('El paquete no es válido.');
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    await FileSystem.deleteAsync(destDir, { idempotent: true }).catch(() => undefined);
    await writeScormError(message);
    throw new Error(message);
  }
  await FileSystem.deleteAsync(result.uri, { idempotent: true });

  // Validar que el archivo de lanzamiento exista: si no, el ZIP está incompleto.
  const href = String(resource.launch_href || '').replace(/^\//, '');
  if (href) {
    const launchInfo = await FileSystem.getInfoAsync(`${destDir}${href}`);
    if (!launchInfo.exists) {
      const message = t('El paquete está incompleto.');
      await FileSystem.deleteAsync(destDir, { idempotent: true }).catch(() => undefined);
      await writeScormError(message);
      throw new Error(message);
    }
  }

  const now = Date.now();
  const saved: DownloadRecord = {
    lessonId: lesson.id,
    courseId: lesson.course_id,
    sourceUrl,
    localUri: destDir,
    size: extracted.bytes,
    downloadedAt: now,
    lastAccessedAt: now,
    kind: 'scorm',
    resourceKey: recordKey,
    title: resource.title,
    mime: 'application/zip',
    serverUpdatedAt: resource.updated_at ?? null,
    updateAvailable: false,
    error: undefined,
    failedAt: undefined,
    scorm: {
      libraryItemId,
      libraryVersionId: link.library_version_id,
      checksum,
      launchHref: resource.launch_href || '',
      scormVersion: link.scorm_version,
      attemptId: link.attempt_id,
    },
  };

  await withManifest(async () => {
    const records = await readManifest();
    const replaced = records.filter((item) => item.resourceKey === recordKey);
    await Promise.all(replaced.map(deleteRecordFile));
    await writeManifest([...records.filter((item) => item.resourceKey !== recordKey), saved]);
  });
  const maintained = await maintainDownloads();
  const kept = maintained.find((item) => item.resourceKey === recordKey);
  if (!kept) throw new Error(t('No hay espacio disponible dentro del límite configurado.'));
  return kept;
}

export async function findScormDownload(lessonId: number, resource: LessonResource): Promise<DownloadRecord | null> {
  const libraryItemId = Number(resource.library_item_id ?? 0);
  const checksum = String(resource.version_checksum_sha256 ?? '');
  if (!libraryItemId || !checksum) return null;
  const key = `${lessonId}:scorm:${libraryItemId}:${checksum}`;
  return touch((record) => kindOf(record) === 'scorm' && record.resourceKey === key);
}

/** Actualiza metadatos SCORM del registro (p.ej. el attemptId creado al abrir con red). */
export async function updateScormDownloadAttemptId(resourceKey: string, attemptId: number): Promise<void> {
  const key = String(resourceKey || '');
  const id = Number(attemptId || 0);
  if (!key || !id) return;
  await withManifest(async () => {
    const records = await readManifest();
    let changed = false;
    const next = records.map((record) => {
      if (kindOf(record) !== 'scorm' || record.resourceKey !== key) return record;
      if (!record.scorm) return record;
      const current = Number(record.scorm?.attemptId ?? 0);
      if (current === id) return record;
      changed = true;
      return { ...record, scorm: { ...record.scorm, attemptId: id } };
    });
    if (changed) await writeManifest(next);
  });
}

export function findResourceDownload(lessonId: number, resource: LessonResource): Promise<DownloadRecord | null> {
  const key = resourceKey(lessonId, resource);
  return touch((record) => record.resourceKey === key);
}

export async function listResourceDownloads(lessonId: number): Promise<DownloadRecord[]> {
  return (await readManifest()).filter((record) => kindOf(record) === 'resource' && record.lessonId === lessonId);
}

export async function listScormDownloads(lessonId: number): Promise<DownloadRecord[]> {
  return (await readManifest()).filter((record) => kindOf(record) === 'scorm' && record.lessonId === lessonId);
}

/**
 * Tras traer una lección nueva: los recursos descargados que cambiaron en el
 * servidor se actualizan solos si son livianos y la red lo permite; si no,
 * quedan marcados "Actualización disponible". Los que ya no existen se borran.
 */
export async function reconcileLessonResources(lesson: LessonDetail): Promise<void> {
  const saved = await listResourceDownloads(lesson.id);
  if (!saved.length) return;
  const settings = await getDownloadSettings();
  const network = await Network.getNetworkStateAsync().catch(() => null);
  const onWifi = network?.type === Network.NetworkStateType.WIFI && network.isConnected === true;
  const current = new Map((lesson.resources ?? []).map((resource) => [resourceKey(lesson.id, resource), resource]));

  for (const record of saved) {
    const resource = record.resourceKey ? current.get(record.resourceKey) : undefined;
    if (!resource || !resource.downloadable) {
      await removeDownloads((item) => item.localUri === record.localUri);
      continue;
    }
    if ((resource.updated_at ?? null) === (record.serverUpdatedAt ?? null)) continue;
    if (shouldAutoUpdate(resource.bytes, onWifi, settings)) {
      try {
        await downloadResource(lesson, resource, { allowCellular: !settings.wifiOnly });
        continue;
      } catch {
        // Si falla, queda a decisión del estudiante.
      }
    }
    await withManifest(async () => {
      const records = await readManifest();
      await writeManifest(records.map((item) => (item.localUri === record.localUri ? { ...item, updateAvailable: true } : item)));
    });
  }
}

async function removeDownloads(match: (record: DownloadRecord) => boolean): Promise<void> {
  await withManifest(async () => {
    const records = await readManifest();
    await Promise.all(records.filter(match).map(deleteRecordFile));
    await writeManifest(records.filter((record) => !match(record)));
  });
}

export function removeLessonDownload(lessonId: number): Promise<void> {
  return removeDownloads((record) => kindOf(record) === 'video' && record.lessonId === lessonId);
}

/** Todo lo descargado de una lección: video y material. */
export function removeLessonAll(lessonId: number): Promise<void> {
  return removeDownloads((record) => record.lessonId === lessonId);
}

export function removeCourseDownloads(courseId: number): Promise<void> {
  return removeDownloads((record) => (record.courseId ?? 0) === courseId);
}

export function removeDownloadFile(localUri: string): Promise<void> {
  return removeDownloads((record) => record.localUri === localUri);
}

export function clearAllDownloads(): Promise<void> {
  return removeDownloads(() => true);
}

/** Videos y material, del más reciente al más antiguo. */
export async function listDownloads(): Promise<DownloadRecord[]> {
  const records = await maintainDownloads();
  return [...records].sort((a, b) => b.downloadedAt - a.downloadedAt);
}

export async function getDownloadUsage(): Promise<{ usedBytes: number; maxBytes: number; courses: CourseUsage[] }> {
  const settings = await getDownloadSettings();
  const usage = summarize(await maintainDownloads(settings));
  return { ...usage, maxBytes: settings.maxBytes };
}

export async function getStorageSummary(): Promise<StorageSummary> {
  const settings = await getDownloadSettings();
  const records = await maintainDownloads(settings);
  return {
    count: records.length,
    usedBytes: records.reduce((sum, record) => sum + record.size, 0),
    maxBytes: settings.maxBytes,
  };
}
