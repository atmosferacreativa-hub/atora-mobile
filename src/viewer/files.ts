import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { PDFJS_LIB, PDFJS_VERSION, PDFJS_WORKER } from './pdfjs.generated';
import { t } from '../i18n/core';

/**
 * Visor de material dentro de la app (0.4.0).
 * - PDF: pdf.js empaquetado, en un WebView que lee el archivo local.
 * - Imágenes: página con zoom.
 * - Otros formatos: la app del sistema.
 * Los archivos del visor se escriben una vez en el almacenamiento privado.
 */

const VIEWER_DIR = `${FileSystem.documentDirectory}viewer-pdfjs-${PDFJS_VERSION}-v1/`;
const VIEWER_VERSION = `${PDFJS_VERSION}-1.0.0`;

export type ViewerKind = 'pdf' | 'image' | 'system';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;

export function viewerKind(mime: string | undefined, uri: string): ViewerKind {
  const type = (mime ?? '').toLowerCase();
  if (type === 'application/pdf' || /\.pdf$/i.test(uri)) return 'pdf';
  if (type.startsWith('image/') || IMAGE_EXT.test(uri)) return 'image';
  return 'system';
}

const PDF_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<style>
body{margin:0;background:#3d4146}
#pages{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0}
canvas{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35)}
#msg{color:#fff;font:15px -apple-system,Roboto,sans-serif;text-align:center;padding:32px 16px}
</style>
<script src="pdf.worker.min.js"></script>
<script src="pdf.min.js"></script>
</head><body><div id="msg"></div><div id="pages"></div>
<script>
(function () {
  function post(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  var query = new URLSearchParams(location.search);
  var file = query.get('file');
  var t0 = Date.now();
  var msg = document.getElementById('msg');
  // 1.0.0: textos en el idioma de la app (vienen en la URL).
  msg.textContent = query.get('opening') || '';
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  pdfjsLib.getDocument({ url: file, isEvalSupported: false }).promise.then(function (pdf) {
    return pdf.getPage(1).then(function (first) {
      msg.remove();
      var width = document.documentElement.clientWidth - 16;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var base = first.getViewport({ scale: 1 });
      var container = document.getElementById('pages');
      var canvases = [];
      for (var i = 1; i <= pdf.numPages; i++) {
        var c = document.createElement('canvas');
        c.style.width = width + 'px';
        c.style.height = Math.round(width * base.height / base.width) + 'px';
        c.dataset.page = String(i);
        container.appendChild(c);
        canvases.push(c);
      }
      function render(c) {
        if (c.dataset.done) return Promise.resolve();
        c.dataset.done = '1';
        return pdf.getPage(Number(c.dataset.page)).then(function (page) {
          var unit = page.getViewport({ scale: 1 });
          var vp = page.getViewport({ scale: width / unit.width * dpr });
          c.width = vp.width; c.height = vp.height;
          c.style.height = Math.round(vp.height / dpr) + 'px';
          return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        });
      }
      // La primera página primero; las demás a medida que se acercan a la pantalla.
      render(canvases[0]).then(function () { post({ type: 'first-page', ms: Date.now() - t0, pages: pdf.numPages }); });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) render(e.target); });
      }, { rootMargin: '1200px 0px' });
      canvases.forEach(function (c) { io.observe(c); });
    });
  }).catch(function (e) {
    msg.textContent = query.get('failed') || '';
    post({ type: 'error', message: String((e && e.message) || e) });
  });
})();
</script></body></html>`;

const IMAGE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=6, user-scalable=yes">
<style>html,body{margin:0;height:100%;background:#111}body{display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%}</style>
</head><body><img id="img" alt=""><script>
var img = document.getElementById('img');
img.onerror = function () { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'image' })); };
img.src = new URLSearchParams(location.search).get('file');
</script></body></html>`;

let ready: Promise<string> | null = null;

/** Escribe pdf.js y las páginas del visor una sola vez por versión. */
export function ensureViewerFiles(): Promise<string> {
  if (!ready) {
    ready = (async () => {
      const marker = await FileSystem.getInfoAsync(`${VIEWER_DIR}ready`);
      // 1.0.0: la página del visor cambió (textos por idioma): se reescribe una vez.
      const current = marker.exists ? await FileSystem.readAsStringAsync(`${VIEWER_DIR}ready`).catch(() => '') : '';
      if (current !== VIEWER_VERSION) {
        await FileSystem.makeDirectoryAsync(VIEWER_DIR, { intermediates: true });
        await FileSystem.writeAsStringAsync(`${VIEWER_DIR}pdf.min.js`, PDFJS_LIB);
        await FileSystem.writeAsStringAsync(`${VIEWER_DIR}pdf.worker.min.js`, PDFJS_WORKER);
        await FileSystem.writeAsStringAsync(`${VIEWER_DIR}pdf.html`, PDF_HTML);
        await FileSystem.writeAsStringAsync(`${VIEWER_DIR}image.html`, IMAGE_HTML);
        await FileSystem.writeAsStringAsync(`${VIEWER_DIR}ready`, VIEWER_VERSION);
      }
      return VIEWER_DIR;
    })().catch((reason) => {
      ready = null;
      throw reason;
    });
  }
  return ready;
}

export async function viewerUrl(kind: 'pdf' | 'image' | 'html', localUri: string): Promise<string> {
  // 0.5.0: un documento HTML guardado (certificado provisional) se abre tal cual.
  if (kind === 'html') return localUri;
  const dir = await ensureViewerFiles();
  const texts = kind === 'pdf' ? `&opening=${encodeURIComponent(t('Abriendo…'))}&failed=${encodeURIComponent(t('No se pudo abrir el PDF.'))}` : '';
  return `${dir}${kind}.html?file=${encodeURIComponent(localUri)}${texts}`;
}

/** Abre un archivo local con la app del sistema (Android: intent VIEW; iOS: hoja de compartir). */
export async function openWithSystem(localUri: string, mime?: string): Promise<void> {
  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(localUri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: mime || '*/*',
    });
    return;
  }
  await Sharing.shareAsync(localUri, mime ? { mimeType: mime } : undefined);
}

export const VIEWER_ROOT = FileSystem.documentDirectory ?? '';
