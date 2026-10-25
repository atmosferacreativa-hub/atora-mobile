describe('offline/downloadSources.isAllowedDownloadSource', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('accepts https always', async () => {
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: { e2e: false } } }));
    const { isAllowedDownloadSource } = await import('../downloadSources');
    expect(isAllowedDownloadSource('https://example.test/file.zip')).toBe(true);
  });

  it('rejects http in production mode by default', async () => {
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: { e2e: false } } }));
    const { isAllowedDownloadSource } = await import('../downloadSources');
    expect(isAllowedDownloadSource('http://127.0.0.1:8080/file.zip')).toBe(false);
  });

  it('allows http localhost in e2e mode (adb reverse)', async () => {
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: { e2e: true } } }));
    const { isAllowedDownloadSource } = await import('../downloadSources');
    expect(isAllowedDownloadSource('http://127.0.0.1:8080/file.zip')).toBe(true);
    expect(isAllowedDownloadSource('http://localhost:8080/file.zip')).toBe(true);
    expect(isAllowedDownloadSource('http://example.test/file.zip')).toBe(false);
  });
});

