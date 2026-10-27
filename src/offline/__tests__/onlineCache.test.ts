jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///doc/',
  deleteAsync: jest.fn(async () => undefined),
}));

describe('offline/onlineCache', () => {
  it('detects online cache files by directory prefix', async () => {
    const { isOnlineCacheUri, ONLINE_CACHE_DIR } = await import('../onlineCache');
    expect(ONLINE_CACHE_DIR).toBe('file:///cache/atora-online/');
    expect(isOnlineCacheUri('file:///cache/atora-online/res-1.pdf')).toBe(true);
    expect(isOnlineCacheUri('file:///cache/atora-online-sub/res-1.pdf')).toBe(false);
    expect(isOnlineCacheUri('file:///doc/atora-online/res-1.pdf')).toBe(false);
  });

  it('cleanupOnlineCache deletes the whole directory idempotently', async () => {
    const FileSystem = await import('expo-file-system/legacy');
    const { cleanupOnlineCache, ONLINE_CACHE_DIR } = await import('../onlineCache');

    await cleanupOnlineCache();

    expect((FileSystem as any).deleteAsync).toHaveBeenCalledWith(ONLINE_CACHE_DIR, { idempotent: true });
  });
});

