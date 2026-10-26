import { isUsableSavedDownload, resolveResourcePressAction } from '../resourceOpenLogic';

describe('offline/resourceOpenLogic', () => {
  it('treats error records as not usable and prevents opening the browser', () => {
    const resource: any = { downloadable: true, url: 'https://example.test/file.pdf', download_url: 'https://example.test/file.pdf' };
    const saved: any = { localUri: 'file:///doc/x', error: 'El servidor no entregó el archivo.' };

    expect(isUsableSavedDownload(saved)).toBe(false);
    expect(resolveResourcePressAction(resource, saved)).toBe('show_error');
  });
});

