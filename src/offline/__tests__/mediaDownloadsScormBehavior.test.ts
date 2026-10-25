jest.mock('../../i18n/core', () => ({ t: (s: string) => s }));

jest.mock('expo-network', () => ({
  NetworkStateType: { WIFI: 1 },
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 1,
  })),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { e2e: false } },
}));

const memFs = new Map<string, { exists: boolean; isDirectory?: boolean; size?: number; content?: string }>();

jest.mock('expo-file-system/legacy', () => {
  const EncodingType = { Base64: 'base64' };
  const documentDirectory = 'file:///doc/';
  const cacheDirectory = 'file:///cache/';

  const ensureDir = async (dir: string) => {
    memFs.set(dir, { exists: true, isDirectory: true });
  };

  return {
    EncodingType,
    documentDirectory,
    cacheDirectory,
    makeDirectoryAsync: jest.fn(async (dir: string) => ensureDir(dir)),
    deleteAsync: jest.fn(async (target: string) => { memFs.delete(target); }),
    getInfoAsync: jest.fn(async (target: string) => {
      const info = memFs.get(target);
      return info ? { exists: true, isDirectory: Boolean(info.isDirectory), size: info.size ?? 0 } : { exists: false, isDirectory: false };
    }),
    readAsStringAsync: jest.fn(async (target: string, opts?: any) => {
      const info = memFs.get(target);
      if (!info || !info.exists) throw new Error(`missing:${target}`);
      if (opts?.encoding === EncodingType.Base64) return info.content ?? '';
      return info.content ?? '';
    }),
    writeAsStringAsync: jest.fn(async (target: string, content: string) => {
      memFs.set(target, { exists: true, size: content.length, content });
    }),
    downloadAsync: jest.fn(async (url: string, dest: string) => {
      memFs.set(dest, { exists: true, size: 123, content: 'AA==' });
      return { uri: dest, status: 200 };
    }),
    readDirectoryAsync: jest.fn(async () => []),
    copyAsync: jest.fn(async () => undefined),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
    __reset: () => { store = {}; },
  };
});

jest.mock('../../api/session', () => ({ getSessionUserId: jest.fn(async () => 1) }));
jest.mock('../../api/scorm', () => ({
  scormDownloadLink: jest.fn(async () => ({
    download_url: 'https://signed.test/pkg.zip',
    library_version_id: 77,
    version_checksum_sha256: 'abc123',
    scorm_version: '1.2',
    attempt_id: 55,
  })),
}));

jest.mock('fflate', () => ({
  unzipSync: jest.fn(() => ({
    'index.html': new Uint8Array([1, 2, 3]),
  })),
}));

describe('offline/mediaDownloads.downloadScormPackage', () => {
  beforeEach(async () => {
    memFs.clear();
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    (AsyncStorage as any).__reset?.();
    jest.clearAllMocks();
  });

  it('downloads ZIP via downloadAsync using the signed URL and expected path', async () => {
    const { downloadScormPackage } = await import('../mediaDownloads');
    const FileSystem = await import('expo-file-system/legacy');

    const record = await downloadScormPackage(
      { id: 10, course_id: 20 },
      { library_item_id: 99, title: 'SCORM', launch_href: 'index.html', updated_at: null } as any,
      'tok',
    );

    expect((FileSystem as any).downloadAsync).toHaveBeenCalledWith(
      'https://signed.test/pkg.zip',
      'file:///doc/atora-offline/scorm/pkg-10-99-abc123.zip',
      { headers: { Authorization: 'Bearer tok' } },
    );

    expect(record.kind).toBe('scorm');
    expect(record.scorm?.libraryItemId).toBe(99);
    expect(record.error).toBeUndefined();
  });

  it('non-200 download status writes an error record and throws', async () => {
    const { downloadScormPackage, listScormDownloads, maintainDownloads } = await import('../mediaDownloads');
    const FileSystem = await import('expo-file-system/legacy');
    (FileSystem as any).downloadAsync.mockResolvedValueOnce({ uri: 'file:///doc/atora-offline/scorm/pkg-10-99-abc123.zip', status: 500 });

    await expect(downloadScormPackage(
      { id: 10, course_id: 20 },
      { library_item_id: 99, title: 'SCORM', launch_href: 'index.html', updated_at: null } as any,
      'tok',
    )).rejects.toThrow('El servidor no entregó el archivo.');

    const records = await listScormDownloads(10);
    expect(records).toHaveLength(1);
    expect(records[0]!.error).toBe('El servidor no entregó el archivo.');

    // El registro de error debe permanecer visible aunque no exista el archivo.
    await maintainDownloads();
    const after = await listScormDownloads(10);
    expect(after).toHaveLength(1);
  });

  it('missing launch file writes an error record and throws', async () => {
    const { downloadScormPackage, listScormDownloads } = await import('../mediaDownloads');
    const FileSystem = await import('expo-file-system/legacy');

    // ZIP extrae index.html, pero launch_href apunta a otro archivo.
    (FileSystem as any).getInfoAsync.mockImplementation(async (target: string) => {
      if (target.endsWith('missing.html')) return { exists: false, isDirectory: false };
      const info = memFs.get(target);
      return info ? { exists: true, isDirectory: Boolean(info.isDirectory), size: info.size ?? 0 } : { exists: false, isDirectory: false };
    });

    await expect(downloadScormPackage(
      { id: 10, course_id: 20 },
      { library_item_id: 99, title: 'SCORM', launch_href: 'missing.html', updated_at: null } as any,
      'tok',
    )).rejects.toThrow('El paquete está incompleto.');

    const records = await listScormDownloads(10);
    expect(records).toHaveLength(1);
    expect(records[0]!.error).toBe('El paquete está incompleto.');
  });
});

