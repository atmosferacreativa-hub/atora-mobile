import { isUsableSavedDownload, resolveResourcePressAction } from '../resourceOpenLogic';

describe('offline/resourceOpenLogic', () => {
  it('treats error records as not usable and prevents opening the browser', () => {
    const resource: any = { downloadable: true, url: 'https://example.test/file.pdf', download_url: 'https://example.test/file.pdf' };
    const saved: any = { localUri: 'file:///doc/x', error: 'El servidor no entregó el archivo.' };

    expect(isUsableSavedDownload(saved)).toBe(false);
    expect(resolveResourcePressAction(resource, saved)).toBe('show_error');
  });

  it('downloads and opens downloadable non-link resources', () => {
    const resource: any = { type: 'file', title: 'Guía PDF', url: 'https://example.test/file.pdf', downloadable: true };
    expect(resolveResourcePressAction(resource, undefined)).toBe('download_and_open');
  });

  it('downloads and opens resources with download_url even if downloadable=false', () => {
    const resource: any = {
      type: 'file',
      title: 'Guía PDF',
      url: 'https://example.test/file.pdf',
      downloadable: false,
      download_url: 'https://example.test/signed',
    };
    expect(resolveResourcePressAction(resource, undefined)).toBe('download_and_open');
  });

  it('opens links in the system browser when not downloaded', () => {
    const resource: any = { type: 'link', title: 'Sitio', url: 'https://example.test', downloadable: true };
    expect(resolveResourcePressAction(resource, undefined)).toBe('open_url');
  });
});

