import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';

const MANIFEST_KEY = 'atora.offline.media.v1';
const SETTINGS_KEY = 'atora.offline.settings.v1';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}atora-offline/`;
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DownloadSettings = {
  wifiOnly: boolean;
  lowDataMode: boolean;
  maxBytes: number;
  retentionDays: number;
};

export type DownloadRecord = {
  lessonId: number;
  sourceUrl: string;
  localUri: string;
  size: number;
  downloadedAt: number;
  lastAccessedAt: number;
};

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
  const raw = await AsyncStorage.getItem(MANIFEST_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as DownloadRecord[] : [];
  } catch {
    return [];
  }
}

async function writeManifest(records: DownloadRecord[]): Promise<void> {
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(records));
}

export async function getDownloadSettings(): Promise<DownloadSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
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
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  await maintainDownloads(settings);
  return settings;
}

async function deleteRecordFile(record: DownloadRecord): Promise<void> {
  await FileSystem.deleteAsync(record.localUri, { idempotent: true });
}

async function validRecords(records: DownloadRecord[]): Promise<DownloadRecord[]> {
  const checked = await Promise.all(records.map(async (record) => {
    const info = await FileSystem.getInfoAsync(record.localUri);
    return info.exists ? record : null;
  }));
  return checked.filter((record): record is DownloadRecord => record !== null);
}

export async function maintainDownloads(
  providedSettings?: DownloadSettings,
): Promise<DownloadRecord[]> {
  const settings = providedSettings ?? await getDownloadSettings();
  const now = Date.now();
  let records = await validRecords(await readManifest());
  const expired = records.filter(
    (record) => now - record.lastAccessedAt > settings.retentionDays * DAY_MS,
  );
  await Promise.all(expired.map(deleteRecordFile));
  const expiredUris = new Set(expired.map((record) => record.localUri));
  records = records.filter((record) => !expiredUris.has(record.localUri));

  records.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  let total = records.reduce((sum, record) => sum + record.size, 0);
  while (total > settings.maxBytes && records.length > 0) {
    const oldest = records.shift();
    if (!oldest) break;
    await deleteRecordFile(oldest);
    total -= oldest.size;
  }
  await writeManifest(records);
  return records;
}

export async function findLessonDownload(
  lessonId: number,
  sourceUrl: string,
): Promise<DownloadRecord | null> {
  const records = await maintainDownloads();
  const index = records.findIndex(
    (record) => record.lessonId === lessonId && record.sourceUrl === sourceUrl,
  );
  if (index < 0) return null;
  const current = records[index];
  if (!current) return null;
  const touched = { ...current, lastAccessedAt: Date.now() };
  records[index] = touched;
  await writeManifest(records);
  return touched;
}

function safeExtension(sourceUrl: string): string {
  const match = new URL(sourceUrl).pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? `.${match[1]!.toLowerCase()}` : '.mp4';
}

export async function downloadLessonMedia(
  lessonId: number,
  sourceUrl: string,
): Promise<DownloadRecord> {
  if (!sourceUrl.startsWith('https://')) {
    throw new Error('Solo se permiten descargas protegidas por HTTPS.');
  }

  const settings = await getDownloadSettings();
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false) {
    throw new Error('Necesitas conexión para descargar esta lección.');
  }
  if (settings.wifiOnly && network.type !== Network.NetworkStateType.WIFI) {
    throw new Error('Las descargas están limitadas a Wi-Fi.');
  }

  await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  await removeLessonDownload(lessonId);
  const destination = `${DOWNLOAD_DIR}lesson-${lessonId}-${Date.now()}${safeExtension(sourceUrl)}`;
  const result = await FileSystem.downloadAsync(sourceUrl, destination);
  const info = await FileSystem.getInfoAsync(result.uri);
  const now = Date.now();
  const record: DownloadRecord = {
    lessonId,
    sourceUrl,
    localUri: result.uri,
    size: info.exists && 'size' in info ? info.size : 0,
    downloadedAt: now,
    lastAccessedAt: now,
  };
  await writeManifest([...await readManifest(), record]);
  const maintained = await maintainDownloads(settings);
  const saved = maintained.find((item) => item.localUri === record.localUri);
  if (!saved) throw new Error('No hay espacio disponible dentro del límite configurado.');
  return saved;
}

export async function removeLessonDownload(lessonId: number): Promise<void> {
  const records = await readManifest();
  const removed = records.filter((record) => record.lessonId === lessonId);
  await Promise.all(removed.map(deleteRecordFile));
  await writeManifest(records.filter((record) => record.lessonId !== lessonId));
}

export async function clearAllDownloads(): Promise<void> {
  const records = await readManifest();
  await Promise.all(records.map(deleteRecordFile));
  await writeManifest([]);
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
