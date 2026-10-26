jest.mock('../../i18n/core', () => ({ t: (s: string) => s }));

jest.mock('expo-network', () => ({
  NetworkStateType: { WIFI: 1 },
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 1,
  })),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false, isDirectory: false })),
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => undefined),
  downloadAsync: jest.fn(async () => ({ uri: 'file:///doc/x', status: 200 })),
  readDirectoryAsync: jest.fn(async () => []),
  copyAsync: jest.fn(async () => undefined),
}));

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
jest.mock('../../api/scorm', () => ({ scormDownloadLink: jest.fn(async () => ({})) }));

describe('offline/mediaDownloads.getDownloadSettings defaults', () => {
  beforeEach(async () => {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    (AsyncStorage as any).__reset?.();
    jest.clearAllMocks();
  });

  it('forces wifiOnly=false in e2e builds', async () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: { e2e: true } } }));

    const { getDownloadSettings } = await import('../mediaDownloads');
    const settings = await getDownloadSettings();
    expect(settings.wifiOnly).toBe(false);
  });

  it('keeps wifiOnly=true by default outside e2e', async () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: { e2e: false } } }));

    const { getDownloadSettings } = await import('../mediaDownloads');
    const settings = await getDownloadSettings();
    expect(settings.wifiOnly).toBe(true);
  });
});

