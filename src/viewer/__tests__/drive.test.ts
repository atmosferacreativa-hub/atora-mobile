import { allowDriveNavigation } from '../drive';

/**
 * 1.0.1 (punto 4): el reproductor de Google Drive carga el video en un iframe de
 * youtube.googleapis.com. En Android, react-native-webview consulta
 * onShouldStartLoadWithRequest también para los iframes: si el dominio no está
 * permitido, el video no aparece y solo queda "Abrir en el navegador".
 */
describe('navegación permitida en el reproductor de Drive', () => {
  it.each([
    'about:blank',
    'https://drive.google.com/file/d/1iMeTyedNEB_hv2iF4GavRGfmROAVtPUq/preview',
    'https://youtube.googleapis.com/embed/?status=ok&docid=1iMeTyedNEB_hv2iF4GavRGfmROAVtPUq',
    'https://workspacevideo-pa.googleapis.com/v1/drive/media',
    'https://drive.usercontent.google.com/download?id=x',
    'https://www.youtube.com/embed/abc',
    'https://i.ytimg.com/vi/abc/hqdefault.jpg',
    'https://rr3---sn-abc.googlevideo.com/videoplayback?x=1',
    'https://lh3.googleusercontent.com/a',
    'https://ssl.gstatic.com/x.js',
    'https://accounts.google.com/ServiceLogin',
  ])('permite %s', (url) => {
    expect(allowDriveNavigation(url)).toBe(true);
  });

  it.each([
    'http://drive.google.com/file/d/x/preview',
    'https://evil.com/?q=google.com',
    'https://google.com.evil.com/',
    'https://googleapis.com.evil.net/',
    'intent://x#Intent;end',
    'javascript:alert(1)',
  ])('bloquea %s', (url) => {
    expect(allowDriveNavigation(url)).toBe(false);
  });
});
