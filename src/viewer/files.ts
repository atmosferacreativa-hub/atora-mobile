import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { PDFJS_LIB, PDFJS_VERSION, PDFJS_WORKER } from './pdfjs.generated';
import { buildViewerUrl } from './buildViewerUrl';
import { t } from '../i18n/core';

/**
 * Visor de material dentro de la app (0.4.0).
 * - PDF: pdf.js empaquetado, en un WebView que lee el archivo local.
 * - Imágenes: página con zoom.
 * - Otros formatos: la app del sistema.
 * Los archivos del visor se escriben una vez en el almacenamiento privado.
 */

const VIEWER_DIR = `${FileSystem.documentDirectory}viewer-pdfjs-${PDFJS_VERSION}-v1/`;
const VIEWER_VERSION = `${PDFJS_VERSION}-1.0.2`;

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
#bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px;background:rgba(0,0,0,.25);backdrop-filter:blur(8px)}
.btn{user-select:none;-webkit-user-select:none;min-width:44px;height:36px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);color:#fff;font:700 15px -apple-system,Roboto,sans-serif;display:flex;align-items:center;justify-content:center}
#scroller{height:calc(100vh - 56px);overflow:auto;-webkit-overflow-scrolling:touch}
#pages{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0}
canvas{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35)}
#msg{color:#fff;font:15px -apple-system,Roboto,sans-serif;text-align:center;padding:32px 16px}
</style>
<script src="pdf.worker.min.js"></script>
<script src="pdf.min.js"></script>
</head><body>
<div id="bar">
  <div class="btn" id="zoomOut">−</div>
  <div class="btn" id="fit">Ajustar</div>
  <div class="btn" id="zoomIn">+</div>
</div>
<div id="scroller"><div id="msg"></div><div id="pages"></div></div>
<script>
(function () {
  function post(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function clamp(v) { return Math.max(1, Math.min(5, v)); }
  var query = new URLSearchParams(location.search);
  var file = query.get('file');
  var t0 = Date.now();
  var msg = document.getElementById('msg');
  msg.textContent = query.get('opening') || '';
  var scroller = document.getElementById('scroller');
  var pages = document.getElementById('pages');
  var zoom = clamp(Number(query.get('z') || localStorage.getItem('atora_pdf_zoom') || '1'));
  var baseWidth = 0;
  var pdfRef = null;
  var canvases = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function updateZoom(next, fromGesture) {
    var z = clamp(next);
    if (z === zoom) return;
    zoom = z;
    localStorage.setItem('atora_pdf_zoom', String(zoom));
    post({ type: 'zoom', zoom: zoom, fromGesture: !!fromGesture });
    layout();
  }

  function layout() {
    if (!pdfRef) return;
    var newBase = Math.max(240, (document.documentElement.clientWidth - 16));
    if (!baseWidth) baseWidth = newBase;
    // En rotación, actualizamos el width base para que "Ajustar" siga siendo el ancho actual.
    baseWidth = newBase;
    canvases.forEach(function (c) {
      c.dataset.done = '';
      var ratio = Number(c.dataset.ratio || '1.414');
      c.style.width = Math.round(baseWidth * zoom) + 'px';
      c.style.height = Math.round(baseWidth * zoom * ratio) + 'px';
    });
    requestAnimationFrame(renderVisible);
  }

  function renderCanvas(c) {
    if (c.dataset.done === '1') return Promise.resolve();
    c.dataset.done = '1';
    return pdfRef.getPage(Number(c.dataset.page)).then(function (page) {
      var unit = page.getViewport({ scale: 1 });
      var ratio = unit.height / unit.width;
      c.dataset.ratio = String(ratio);
      var targetWidth = baseWidth * zoom;
      var vp = page.getViewport({ scale: (targetWidth / unit.width) * dpr });
      c.width = vp.width; c.height = vp.height;
      c.style.width = Math.round(targetWidth) + 'px';
      c.style.height = Math.round(targetWidth * ratio) + 'px';
      return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    });
  }

  function renderVisible() {
    var top = scroller.scrollTop;
    var bottom = top + scroller.clientHeight;
    canvases.forEach(function (c) {
      var y = c.offsetTop;
      if (y < bottom + 1400 && (y + c.offsetHeight) > top - 800) void renderCanvas(c);
    });
  }

  // Botones.
  document.getElementById('zoomIn').addEventListener('click', function () { updateZoom(zoom + 0.25); });
  document.getElementById('zoomOut').addEventListener('click', function () { updateZoom(zoom - 0.25); });
  document.getElementById('fit').addEventListener('click', function () { updateZoom(1); });

  // Doble toque: alterna 1 ↔ 2.
  var lastTap = 0;
  scroller.addEventListener('touchend', function (e) {
    if (e.touches && e.touches.length) return;
    var now = Date.now();
    if (now - lastTap < 320) {
      updateZoom(zoom > 1 ? 1 : 2, true);
      lastTap = 0;
    } else {
      lastTap = now;
    }
  }, { passive: true });

  // Pinch zoom (simple, 2 dedos) + mantener scroll.
  var pinch = { active: false, d0: 0, z0: 1 };
  scroller.addEventListener('touchstart', function (e) {
    if (e.touches && e.touches.length === 2) {
      var a = e.touches[0], b = e.touches[1];
      pinch.active = true;
      pinch.d0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinch.z0 = zoom;
    }
  }, { passive: true });
  scroller.addEventListener('touchmove', function (e) {
    if (!pinch.active || !e.touches || e.touches.length !== 2) return;
    var a = e.touches[0], b = e.touches[1];
    var d1 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (!pinch.d0) return;
    updateZoom(pinch.z0 * (d1 / pinch.d0), true);
  }, { passive: true });
  scroller.addEventListener('touchend', function () { pinch.active = false; }, { passive: true });

  // PDF load.
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  pdfjsLib.getDocument({ url: file, isEvalSupported: false }).promise.then(function (pdf) {
    pdfRef = pdf;
    return pdf.getPage(1).then(function (first) {
      msg.remove();
      baseWidth = Math.max(240, (document.documentElement.clientWidth - 16));
      var base = first.getViewport({ scale: 1 });
      var ratio = base.height / base.width;
      for (var i = 1; i <= pdf.numPages; i++) {
        var c = document.createElement('canvas');
        c.dataset.page = String(i);
        c.dataset.ratio = String(ratio);
        pages.appendChild(c);
        canvases.push(c);
      }

      renderCanvas(canvases[0]).then(function () { post({ type: 'first-page', ms: Date.now() - t0, pages: pdf.numPages, zoom: zoom }); });
      scroller.addEventListener('scroll', function () { requestAnimationFrame(renderVisible); }, { passive: true });
      window.addEventListener('resize', function () { layout(); }, { passive: true });
      layout();
    });
  }).catch(function (e) {
    msg.textContent = query.get('failed') || '';
    post({ type: 'error', message: String((e && e.message) || e) });
  });

  window.__atoraViewer = {
    zoomIn: function () { updateZoom(zoom + 0.25); },
    zoomOut: function () { updateZoom(zoom - 0.25); },
    fitWidth: function () { updateZoom(1); },
    setZoom: function (z) { updateZoom(z); },
    getZoom: function () { return zoom; },
  };
})();
</script></body></html>`;

const IMAGE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=6, user-scalable=yes">
<style>
html,body{margin:0;height:100%;background:#111;overflow:hidden}
#bar{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px;background:rgba(0,0,0,.25);backdrop-filter:blur(8px)}
.btn{user-select:none;-webkit-user-select:none;min-width:44px;height:36px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);color:#fff;font:700 15px -apple-system,Roboto,sans-serif;display:flex;align-items:center;justify-content:center}
#stage{position:absolute;top:56px;left:0;right:0;bottom:0;touch-action:none}
img{position:absolute;left:50%;top:50%;transform-origin:0 0;will-change:transform}
</style>
</head><body>
<div id="bar">
  <div class="btn" id="zoomOut">−</div>
  <div class="btn" id="fit">Ajustar</div>
  <div class="btn" id="zoomIn">+</div>
</div>
<div id="stage"><img id="img" alt=""></div>
<script>
(function(){
  function post(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function clamp(v) { return Math.max(1, Math.min(6, v)); }
  var query = new URLSearchParams(location.search);
  var uri = query.get('file');
  var img = document.getElementById('img');
  var stage = document.getElementById('stage');

  var state = { s: clamp(Number(query.get('z') || localStorage.getItem('atora_img_zoom') || '1')), x: 0, y: 0 };
  var imgW = 1, imgH = 1;

  function apply(){
    localStorage.setItem('atora_img_zoom', String(state.s));
    var cx = stage.clientWidth / 2;
    var cy = stage.clientHeight / 2;
    // Transform: translate to center, then offset/pan, then scale.
    var tx = cx + state.x;
    var ty = cy + state.y;
    img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + state.s + ') translate(' + (-imgW/2) + 'px,' + (-imgH/2) + 'px)';
    post({ type: 'zoom', zoom: state.s });
  }

  function fit(){
    var sx = stage.clientWidth / imgW;
    var sy = stage.clientHeight / imgH;
    state.s = clamp(Math.min(sx, sy));
    state.x = 0; state.y = 0;
    apply();
  }

  function zoomTo(z){ state.s = clamp(z); apply(); }

  document.getElementById('zoomIn').addEventListener('click', function(){ zoomTo(state.s + 0.25); });
  document.getElementById('zoomOut').addEventListener('click', function(){ zoomTo(state.s - 0.25); });
  document.getElementById('fit').addEventListener('click', function(){ fit(); });

  // Gestos pointer: pan 1 dedo / pinch 2 dedos.
  var pointers = new Map();
  var gesture = { mode: '', s0: 1, x0: 0, y0: 0, d0: 0, c0: null };

  stage.addEventListener('pointerdown', function(e){
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      gesture.mode = 'pan';
      gesture.x0 = state.x; gesture.y0 = state.y;
      gesture.c0 = { x: e.clientX, y: e.clientY };
    }
    if (pointers.size === 2) {
      var a = Array.from(pointers.values())[0];
      var b = Array.from(pointers.values())[1];
      gesture.mode = 'pinch';
      gesture.s0 = state.s;
      gesture.d0 = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  stage.addEventListener('pointermove', function(e){
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.mode === 'pan' && pointers.size === 1 && gesture.c0) {
      state.x = gesture.x0 + (e.clientX - gesture.c0.x);
      state.y = gesture.y0 + (e.clientY - gesture.c0.y);
      apply();
    }
    if (gesture.mode === 'pinch' && pointers.size === 2) {
      var a = Array.from(pointers.values())[0];
      var b = Array.from(pointers.values())[1];
      var d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.d0) {
        state.s = clamp(gesture.s0 * (d1 / gesture.d0));
        apply();
      }
    }
  });
  stage.addEventListener('pointerup', function(e){ pointers.delete(e.pointerId); if (pointers.size === 0) gesture.mode = ''; });
  stage.addEventListener('pointercancel', function(e){ pointers.delete(e.pointerId); if (pointers.size === 0) gesture.mode = ''; });

  // Doble toque: alterna fit ↔ 2x.
  var lastTap = 0;
  stage.addEventListener('click', function(){
    var now = Date.now();
    if (now - lastTap < 320) {
      if (Math.abs(state.s - 1) < 0.05) zoomTo(2); else zoomTo(1);
      lastTap = 0;
    } else {
      lastTap = now;
    }
  });

  img.onerror = function () { post({ type: 'error', message: 'image' }); };
  img.onload = function () {
    imgW = img.naturalWidth || 1;
    imgH = img.naturalHeight || 1;
    if (!query.get('z') && !localStorage.getItem('atora_img_zoom')) fit();
    else apply();
    post({ type: 'ready' });
  };
  img.src = uri;

  window.__atoraViewer = {
    zoomIn: function(){ zoomTo(state.s + 0.25); },
    zoomOut: function(){ zoomTo(state.s - 0.25); },
    fitWidth: function(){ fit(); },
    setZoom: function(z){ zoomTo(z); },
    getZoom: function(){ return state.s; },
  };
})();
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
  const dir = await ensureViewerFiles();
  return buildViewerUrl(kind, dir, localUri, {
    openingText: kind === 'pdf' ? t('Abriendo…') : undefined,
    failedText: kind === 'pdf' ? t('No se pudo abrir el PDF.') : undefined,
  });
}

export type ViewerUrlOptions = Parameters<typeof buildViewerUrl>[3];

export async function viewerUrlWithOptions(kind: 'pdf' | 'image' | 'html', localUri: string, options: ViewerUrlOptions): Promise<string> {
  const dir = await ensureViewerFiles();
  const baseOpts = {
    openingText: kind === 'pdf' ? t('Abriendo…') : undefined,
    failedText: kind === 'pdf' ? t('No se pudo abrir el PDF.') : undefined,
  };
  return buildViewerUrl(kind, dir, localUri, { ...baseOpts, ...options });
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
