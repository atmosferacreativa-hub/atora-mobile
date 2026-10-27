jest.mock('../../i18n/core', () => ({ t: (s: string) => s }));

jest.mock('../mediaDownloads', () => ({
  downloadResource: jest.fn(async () => {
    throw new Error('Las descargas están limitadas a Wi-Fi.');
  }),
}));

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
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false, isDirectory: false, size: 0 })),
  downloadAsync: jest.fn(async () => ({ uri: 'file:///doc/x', status: 200 })),
}));

describe('offline/resourceDownloadAndOpen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    expect((FileSystem as any).downloadAsync).not.toHaveBeenCalled();
    expect(openLocal).not.toHaveBeenCalled();
    expect(onOpenResource).toHaveBeenCalledWith({
      title: 'Guía',
      localUri: 'https://example.test/guia.pdf',
      kind: 'pdf',
      mime: 'application/pdf',
    });
    expect(openUrl).not.toHaveBeenCalled();
    expect(setNotice).toHaveBeenCalledWith('Para guardarlo sin conexión, conéctate a Wi-Fi.');
  });
});

