jest.mock('../../i18n/core', () => ({ t: (s: string) => s }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { e2e: false } } }));

jest.mock('../../runtimeConfig', () => ({ getApiBaseUrlSync: jest.fn(() => '') }));

jest.mock('../mediaDownloads', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DownloadBlockedError } = require('../downloadErrors');
  return {
    downloadResource: jest.fn(async () => {
      throw new DownloadBlockedError('wifi_only', 'Las descargas están limitadas a Wi-Fi.');
    }),
  };
});

jest.mock('../../viewer/files', () => ({
  viewerKind: jest.fn((mime: string | undefined, uri: string) => {
    const type = String(mime ?? '').toLowerCase();
    if (type === 'application/pdf' || uri.toLowerCase().endsWith('.pdf')) return 'pdf';
    return 'system';
  }),
}));

jest.mock('expo-network', () => ({
  NetworkStateType: { WIFI: 1, CELLULAR: 2 },
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 2,
  })),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false, isDirectory: false, size: 0 })),
  downloadAsync: jest.fn(async () => ({ uri: 'file:///cache/x.pdf', status: 200 })),
}));

describe('offline/resourceDownloadAndOpen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = require('../../runtimeConfig');
    runtime.getApiBaseUrlSync.mockReturnValue('');
  });

  it('wifiOnly + cellular opens online (in-app viewer) without downloading', async () => {
    const { downloadAndOpenResourceOrOpenOnline } = await import('../resourceDownloadAndOpen');
    const FileSystem = await import('expo-file-system/legacy');

    const onOpenResource = jest.fn();
    const openUrl = jest.fn(async () => undefined);
    const openLocal = jest.fn(async () => undefined);
    const setNotice = jest.fn();
    const loadSavedResources = jest.fn(async () => undefined);

    await downloadAndOpenResourceOrOpenOnline({
      lesson: { id: 1, course_id: 2 },
      resource: {
        id: 7,
        type: 'pdf',
        title: 'Guía',
        mime: 'application/pdf',
        downloadable: true,
        url: 'https://example.test/guia.pdf',
        download_url: 'https://example.test/guia.pdf',
        updated_at: null,
      } as any,
      loadSavedResources,
      openLocal,
      onOpenResource,
      openUrl,
      setNotice,
    });

    expect((FileSystem as any).downloadAsync).toHaveBeenCalledTimes(1);
    const call = ((FileSystem as any).downloadAsync as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://example.test/guia.pdf');
    expect(String(call[1])).toMatch(/^file:\/\/\/cache\/atora-online\/res-\d+\.pdf$/);
    expect(openLocal).not.toHaveBeenCalled();
    expect(onOpenResource).toHaveBeenCalledWith({
      title: 'Guía',
      localUri: 'file:///cache/x.pdf',
      kind: 'pdf',
      mime: 'application/pdf',
    });
    expect(openUrl).not.toHaveBeenCalled();
    expect(setNotice).toHaveBeenCalledWith('Para guardarlo sin conexión, conéctate a Wi-Fi.');
  });

  it('adds Authorization header when opening an API-protected resource online', async () => {
    const runtime = await import('../../runtimeConfig');
    (runtime.getApiBaseUrlSync as unknown as jest.Mock).mockReturnValue('https://api.test/wp-json/atora-mobile/v1');
    const { downloadAndOpenResourceOrOpenOnline } = await import('../resourceDownloadAndOpen');
    const FileSystem = await import('expo-file-system/legacy');

    const onOpenResource = jest.fn();
    const openUrl = jest.fn(async () => undefined);
    const openLocal = jest.fn(async () => undefined);
    const setNotice = jest.fn();
    const loadSavedResources = jest.fn(async () => undefined);

    await downloadAndOpenResourceOrOpenOnline({
      lesson: { id: 1, course_id: 2 },
      token: 'token-123',
      resource: {
        id: 7,
        type: 'pdf',
        title: 'Guía',
        mime: 'application/pdf',
        downloadable: true,
        url: 'https://api.test/wp-json/atora-mobile/v1/protected.pdf',
        download_url: 'https://api.test/wp-json/atora-mobile/v1/protected.pdf',
        updated_at: null,
      } as any,
      loadSavedResources,
      openLocal,
      onOpenResource,
      openUrl,
      setNotice,
    });

    const opts = ((FileSystem as any).downloadAsync as jest.Mock).mock.calls[0]?.[2];
    expect(opts?.headers?.Authorization).toBe('Bearer token-123');
  });

  it('does not add Authorization header for origin/path lookalikes', async () => {
    const runtime = await import('../../runtimeConfig');
    (runtime.getApiBaseUrlSync as unknown as jest.Mock).mockReturnValue('https://academia.com/wp-json/atora-mobile/v1');
    const { downloadAndOpenResourceOrOpenOnline } = await import('../resourceDownloadAndOpen');
    const FileSystem = await import('expo-file-system/legacy');

    const onOpenResource = jest.fn();
    const openUrl = jest.fn(async () => undefined);
    const openLocal = jest.fn(async () => undefined);
    const setNotice = jest.fn();
    const loadSavedResources = jest.fn(async () => undefined);

    await downloadAndOpenResourceOrOpenOnline({
      lesson: { id: 1, course_id: 2 },
      token: 'token-123',
      resource: {
        id: 7,
        type: 'pdf',
        title: 'Guía',
        mime: 'application/pdf',
        downloadable: true,
        url: 'https://academia.com.otro.com/wp-json/atora-mobile/v1/protected.pdf',
        download_url: 'https://academia.com.otro.com/wp-json/atora-mobile/v1/protected.pdf',
        updated_at: null,
      } as any,
      loadSavedResources,
      openLocal,
      onOpenResource,
      openUrl,
      setNotice,
    });

    let opts = ((FileSystem as any).downloadAsync as jest.Mock).mock.calls[0]?.[2];
    expect(opts?.headers?.Authorization).toBeUndefined();

    ((FileSystem as any).downloadAsync as jest.Mock).mockClear();
    await downloadAndOpenResourceOrOpenOnline({
      lesson: { id: 1, course_id: 2 },
      token: 'token-123',
      resource: {
        id: 7,
        type: 'pdf',
        title: 'Guía',
        mime: 'application/pdf',
        downloadable: true,
        url: 'https://academia.com/wp-json/atora-mobile/v1evil/protected.pdf',
        download_url: 'https://academia.com/wp-json/atora-mobile/v1evil/protected.pdf',
        updated_at: null,
      } as any,
      loadSavedResources,
      openLocal,
      onOpenResource,
      openUrl,
      setNotice,
    });

    opts = ((FileSystem as any).downloadAsync as jest.Mock).mock.calls[0]?.[2];
    expect(opts?.headers?.Authorization).toBeUndefined();
  });
});

