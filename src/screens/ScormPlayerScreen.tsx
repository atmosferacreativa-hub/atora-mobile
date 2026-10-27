import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import type { LessonResource } from '../types';
import { colors, spacing } from '../theme';
import { t } from '../i18n';
import { downloadScormPackage, findScormDownload, updateScormDownloadAttemptId, type DownloadRecord } from '../offline/mediaDownloads';
import { enqueueScormCommit, isScormNoAttemptsError, scormGetValues, startScormAttempt, SCORM_COMMIT } from '../api/scorm';
import { refreshLesson } from '../api/courses';
import { flushOutbox, listOutbox, subscribeOutbox } from '../offline/outbox/runtime';
import { formatBytes } from '../offline/downloadsMath';
import { buildScormInjectedRuntime } from '../scorm/runtime';
import { isAllowedScormFileUrl } from '../scorm/urls';
import { mergeScormValues } from '../scorm/values';
import { startLocalScormServer } from '../scorm/localServer';
import { decideScormOutboxTick } from '../scorm/outboxTickDecision';

type Props = {
  token: string;
  lessonId: number;
  courseId: number;
  resource: LessonResource;
  onBack: () => void;
};

function buildScormWrapperHtml(params: { launchPath: string; includeE2EProbes: boolean }): string {
  const launchPath = String(params.launchPath || '').replace(/^\//, '');
  const safeLaunch = launchPath.replace(/"/g, '%22');
  const includeE2EProbes = Boolean(params.includeE2EProbes);

  // SCORM packages sometimes expect `window.API` / `window.API_1484_11` to exist in their own window
  // (not only in the parent frame). We expose the injected API objects into the iframe as soon as
  // it loads, keeping the token on the native side.
  const bridgeScript = `
    <script>
      (function(){
        var frame = document.getElementById('atora_scorm');
        function exposeApi(){
          try {
            var w = frame && frame.contentWindow;
            if (!w) return;
            if (window.API) w.API = window.API;
            if (window.API_1484_11) w.API_1484_11 = window.API_1484_11;
          } catch(e) {}
        }
        try { frame && frame.addEventListener('load', exposeApi); } catch(e) {}
        setTimeout(exposeApi, 0);
        setTimeout(exposeApi, 200);
      })();
    </script>
`;

  const e2eScript = includeE2EProbes
    ? `
    <script>
      (function(){
        var frame = document.getElementById('atora_scorm');
        function post(msg){
          try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {}
        }
        function normalizeText(text){
          return String(text || '').replace(/\s+/g,' ').trim().slice(0,220);
        }
        function onFrameLoaded(){
          try {
            var w = frame && frame.contentWindow;
            var d = frame && frame.contentDocument;
            function sample(){
              try {
                if (!d) return;
                var title = d.title ? String(d.title) : '';
                var body = (d.body && d.body.innerText) ? String(d.body.innerText) : '';
                var text = normalizeText((title ? (title + ' — ') : '') + body);
                post({ type: 'atora.pageText', text: text || '(sin texto)' });
              } catch(e) {}
            }
            sample();
            // XHR/fetch: el texto puede aparecer después del load.
            for (var i = 1; i <= 10; i += 1) {
              setTimeout(sample, i * 500);
            }
            // Hardening: no permitir escapar a carpeta padre ni acceder a "otro paquete".
            // Solo aplicable a http(s) (server local). En file:// no hacemos fetch.
            if (w && w.location && (w.location.protocol === 'http:' || w.location.protocol === 'https:') && typeof w.fetch === 'function') {
              var seg = (w.location.pathname || '').split('/').filter(Boolean)[0] || '';
              var other = seg ? (seg + 'x') : 'other';
              Promise.all([
                w.fetch('../').then(function(r){return r && r.ok;}).catch(function(){return false;}),
                w.fetch('/' + other + '/index.html').then(function(r){return r && r.ok;}).catch(function(){return false;}),
              ]).then(function(res){
                post({ type: 'atora.escapeCheck', parentOk: !!res[0], otherOk: !!res[1] });
              });
            }
          } catch(e) {}
        }
        try { frame && frame.addEventListener('load', onFrameLoaded); } catch(e) {}
        // Si el iframe carga demasiado rápido, puede perderse el evento 'load'.
        setTimeout(onFrameLoaded, 0);
        setTimeout(onFrameLoaded, 200);
      })();
    </script>
`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html,body{margin:0;padding:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%}</style>
  </head>
  <body>
    <iframe id="atora_scorm" src="${safeLaunch}" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals" allow="fullscreen"></iframe>
    ${bridgeScript}
    ${e2eScript}
  </body>
</html>`;
}

/** Reproductor SCORM (1.1.0) desde archivos locales, con commits vía outbox. */
export function ScormPlayerScreen({ token, lessonId, courseId, resource, onBack }: Props) {
  const webRef = useRef<WebView>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState<DownloadRecord | null>(null);
  // `baseUrl`: carpeta raíz (file://) o base HTTP del server local (incluye token y termina en "/").
  const [baseUrl, setBaseUrl] = useState('');
  // `launchPath`: ruta dentro del paquete (sin "/" inicial).
  const [launchPath, setLaunchPath] = useState('');
  // iOS: wrapper guardado dentro del paquete (no HTML inline + baseUrl file://).
  const [wrapperUri, setWrapperUri] = useState('');
  const [pageText, setPageText] = useState('');
  const [escapeCheckText, setEscapeCheckText] = useState('');
  const [serverStateText, setServerStateText] = useState('');
  const [lastCommitText, setLastCommitText] = useState('');
  const [attemptId, setAttemptId] = useState(0);
  const [syncNotice, setSyncNotice] = useState('');
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const valuesRef = useRef<Record<string, string>>({});
  const statePathRef = useRef('');
  const serverRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const serverOriginRef = useRef('');
  const serverTokenRef = useRef('');
  const androidServeRef = useRef<{ packageDir: string; launchPath: string } | null>(null);

  const isE2E = Boolean((Constants.expoConfig?.extra as { e2e?: boolean } | undefined)?.e2e);

  const libraryItemId = Number(resource.library_item_id ?? 0);
  const scormVersion = String(resource.scorm_version ?? '');
  const launchHref = String(resource.launch_href ?? '');
  const expectedBytes = resource.bytes ?? null;

  useEffect(() => {
    void ScreenOrientation.unlockAsync().catch(() => undefined);
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const pending = androidServeRef.current;
        if (Platform.OS === 'android' && pending && !serverRef.current) {
          void startLocalScormServer(pending.packageDir)
            .then((server) => {
              serverRef.current = { stop: server.stop };
              serverOriginRef.current = server.origin;
              serverTokenRef.current = server.token;
              setLaunchPath(pending.launchPath);
              setBaseUrl(`${server.origin}/${server.token}/`);
              setWrapperUri(`${server.origin}/${server.token}/.atora-wrapper.html`);
            })
            .catch(() => undefined);
        }
        return;
      }
      // Inactivo / background: detener server.
      const server = serverRef.current;
      serverRef.current = null;
      serverOriginRef.current = '';
      serverTokenRef.current = '';
      if (server) void server.stop().catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return () => {
      const server = serverRef.current;
      serverRef.current = null;
      serverOriginRef.current = '';
      serverTokenRef.current = '';
      if (server) void server.stop().catch(() => undefined);
    };
  }, []);

  const ensureLocal = useCallback(async () => {
    setNotice('');
    const saved = await findScormDownload(lessonId, resource);
    if (saved) {
      setRecord(saved);
      setAttemptId(Number(saved.scorm?.attemptId ?? 0));
      return saved;
    }
    return null;
  }, [lessonId, resource]);

  const hasNetwork = useCallback(async (): Promise<boolean> => {
    const network = await Network.getNetworkStateAsync().catch(() => null);
    return Boolean(network?.isConnected && network.isInternetReachable !== false);
  }, []);

  const refreshSyncNotice = useCallback(async () => {
    if (!attemptId) {
      setSyncNotice('');
      return;
    }
    const all = await listOutbox().catch(() => ({ pending: [], failed: [] }));
    const mineFailed = all.failed.filter((event) => event.type === SCORM_COMMIT && (event.payload as any)?.attemptId === attemptId);
    if (mineFailed.length) {
      setSyncNotice(t('Último intento: {error}', { error: mineFailed[0]!.lastError || t('Error desconocido') }));
      return;
    }
    const minePending = all.pending.filter((event) => event.type === SCORM_COMMIT && (event.payload as any)?.attemptId === attemptId);
    setSyncNotice(minePending.length ? t('Pendiente · se enviará al tener conexión') : '');
  }, [attemptId]);

  useEffect(() => {
    void refreshSyncNotice();
    return subscribeOutbox(() => void refreshSyncNotice());
  }, [refreshSyncNotice]);

  const refreshServerState = useCallback(async (currentAttemptId: number) => {
    if (!isE2E || !currentAttemptId) return;

    const online = await hasNetwork();
    if (!online) return;

    const values = await scormGetValues(token, currentAttemptId).catch(() => null);
    const status = String(values?.values?.['cmi.core.lesson_status'] ?? values?.values?.['cmi.completion_status'] ?? '').toLowerCase();
    const score = String(values?.values?.['cmi.core.score.raw'] ?? values?.values?.['cmi.score.raw'] ?? '').trim();
    const location = String(values?.values?.['cmi.core.lesson_location'] ?? values?.values?.['cmi.location'] ?? '').trim();
    const parts: string[] = [];
    if (status) parts.push(`STATUS:${status}`);
    if (score) parts.push(`SCORE:${score}`);
    if (location) parts.push(`LOC:${location.slice(0, 18)}`);

    const lesson = await refreshLesson(lessonId, token).catch(() => null);
    if (lesson) parts.push(lesson.completed ? 'LESSON:OK' : 'LESSON:NO');

    setServerStateText(parts.length ? `SERVER:${parts.join(',')}` : '');
  }, [hasNetwork, isE2E, lessonId, token]);

  const openFromRecord = useCallback(async (saved: DownloadRecord) => {
    const base = saved.localUri;
    const baseDir = base.endsWith('/') ? base : `${base}/`;
    const complete = await FileSystem.getInfoAsync(`${base}.atora-complete`).catch(() => ({ exists: false } as any));
    if (!complete.exists) throw new Error(t('La descarga del paquete no está completa. Vuelve a descargarlo.'));
    const href = saved.scorm?.launchHref || launchHref;
    if (!href) throw new Error(t('El paquete SCORM no tiene launch file.'));
    const localUri = `${baseDir}${href.replace(/^\//, '')}`;
    const info = await FileSystem.getInfoAsync(localUri).catch(() => ({ exists: false } as any));
    if (!info.exists) throw new Error(t('El archivo principal no existe. Vuelve a descargar el paquete.'));

    const online = await hasNetwork();
    let resolvedAttemptId = Number(saved.scorm?.attemptId ?? 0);
    if (online && !resolvedAttemptId) {
      try {
        const started = await startScormAttempt(token, lessonId, libraryItemId);
        resolvedAttemptId = Number(started.attempt_id ?? 0);
	        if (resolvedAttemptId && saved.scorm) {
	          const key = saved.resourceKey ?? '';
	          if (key) await updateScormDownloadAttemptId(key, resolvedAttemptId).catch(() => undefined);
	          saved = { ...saved, scorm: { ...saved.scorm, attemptId: resolvedAttemptId } };
	          setRecord(saved);
	        }
      } catch (reason) {
        if (isScormNoAttemptsError(reason)) throw new Error(t('No quedan intentos disponibles para este SCORM.'));
        throw reason;
      }
    }
    if (!online && !resolvedAttemptId) throw new Error(t('Necesitas conexión para iniciar el intento por primera vez.'));
    setAttemptId(resolvedAttemptId);

    const stateDir = `${FileSystem.documentDirectory}atora-offline/scorm-state/`;
    await FileSystem.makeDirectoryAsync(stateDir, { intermediates: true }).catch(() => undefined);
    const safeKey = String(saved.resourceKey || saved.localUri).replace(/[^a-zA-Z0-9:_-]+/g, '_');
    const statePath = `${stateDir}${safeKey}-a${resolvedAttemptId || 0}.atora-cmi.json`;
    statePathRef.current = statePath;
    let localValues: Record<string, string> = {};
    const stored = await FileSystem.readAsStringAsync(statePath).catch(() => '');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (parsed && typeof parsed === 'object') localValues = parsed as Record<string, string>;
      } catch {
        localValues = {};
      }
    }

    let values = localValues;
    if (online && resolvedAttemptId) {
      const server = await scormGetValues(token, resolvedAttemptId).catch(() => null);
      if (server?.values) {
        values = mergeScormValues(localValues, server.values);
        await FileSystem.writeAsStringAsync(statePath, JSON.stringify(values)).catch(() => undefined);
      }
    }

    valuesRef.current = values;
    setInitialValues(values);

    // La ruta de lanzamiento dentro del paquete (sin "/" inicial).
    const launchPath = String(href || 'index.html').replace(/^\//, '');
    setLaunchPath(launchPath);
    androidServeRef.current = { packageDir: baseDir, launchPath };

    // El wrapper debe ser un archivo dentro del paquete.
    // - iOS: WebView + file:// requiere un archivo + allowingReadAccessToURL.
    // - Android: el wrapper por URI HTTP garantiza mismo origen con el iframe (API accesible).
    const wrapperPath = `${baseDir}.atora-wrapper.html`;
    const html = buildScormWrapperHtml({ launchPath, includeE2EProbes: isE2E });
    await FileSystem.writeAsStringAsync(wrapperPath, html).catch(() => undefined);

    if (Platform.OS === 'ios') setWrapperUri(wrapperPath);

    // Android: algunos paquetes (Rise/Storyline) usan XHR/fetch y fallan con file://.
    // Se sirven desde 127.0.0.1 con puerto aleatorio y token (carpeta) en la ruta.
    if (Platform.OS === 'android') {
      if (!serverRef.current) {
        const server = await startLocalScormServer(baseDir);
        serverRef.current = { stop: server.stop };
        serverOriginRef.current = server.origin;
        serverTokenRef.current = server.token;
      }
      const origin = serverOriginRef.current;
      const tok = serverTokenRef.current;
      setBaseUrl(`${origin}/${tok}/`);
      setWrapperUri(`${origin}/${tok}/.atora-wrapper.html`);
      return;
    }

    setBaseUrl(baseDir);
	  }, [hasNetwork, launchHref, token, lessonId, libraryItemId]);

  useEffect(() => {
    let active = true;
    void ensureLocal()
      .then((saved) => (saved ? openFromRecord(saved) : null))
      .catch((reason) => {
        if (!active) return;
        setNotice(reason instanceof Error ? reason.message : t('No se pudo abrir el paquete.'));
      });
    return () => { active = false; };
  }, [ensureLocal, openFromRecord]);

  const startDownload = async () => {
    if (!libraryItemId) {
      setNotice(t('Este material no está disponible.'));
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const online = await hasNetwork();
      if (!online) {
        setNotice(t('Necesitas conexión para iniciar el intento y descargar el paquete.'));
        return;
      }
      const saved = await downloadScormPackage({ id: lessonId, course_id: courseId }, resource, token);
      setRecord(saved);
      setAttemptId(Number(saved.scorm?.attemptId ?? 0));
      await openFromRecord(saved);
    } catch (reason) {
      if (isScormNoAttemptsError(reason)) {
        setNotice(t('No quedan intentos disponibles para este SCORM.'));
        return;
      }
      setNotice(reason instanceof Error ? reason.message : t('No fue posible descargar el SCORM.'));
    } finally {
      setBusy(false);
    }
  };

  const injected = useMemo(() => buildScormInjectedRuntime({
    attemptId,
    scormVersion: scormVersion || '1.2',
    initialValues,
  }), [attemptId, scormVersion, initialValues]);

  useEffect(() => {
    if (!attemptId) return;
    let timer: any = null;
    let active = true;
    let hadPending = false;
    const tick = async () => {
      if (!active) return;
      const all = await listOutbox().catch(() => ({ pending: [], failed: [] }));
      const minePending = all.pending.filter((event) => event.type === SCORM_COMMIT && (event.payload as any)?.attemptId === attemptId);
      const online = await hasNetwork();
      const decision = decideScormOutboxTick({ online, pendingCount: minePending.length, hadPending });
      hadPending = decision.hadPending;
      if (!online) return;
      if (decision.shouldFlush) {
        await flushOutbox(token).catch(() => undefined);
      }
      if (decision.shouldRefreshServerState) {
        await refreshSyncNotice();
        await refreshServerState(attemptId);
      }
    };

    // Reintenta la cola mientras haya commits pendientes para este intento.
    timer = setInterval(() => void tick(), 2_000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [attemptId, hasNetwork, refreshServerState, refreshSyncNotice, token]);

  if (!baseUrl || !launchPath || !wrapperUri) {
    return (
      <View style={styles.screen}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
            <Text style={styles.back}>{t('← Volver')}</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>{resource.title || t('SCORM')}</Text>
          <View style={styles.right} />
        </View>
        <View style={styles.center}>
          {busy ? <ActivityIndicator color={colors.blue} /> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {!busy ? (
            <Pressable accessibilityRole="button" onPress={() => void startDownload()} style={styles.button}>
              <Text style={styles.buttonText}>{t('Descargar y abrir')}{expectedBytes ? ` · ${formatBytes(expectedBytes)}` : ''}</Text>
            </Pressable>
          ) : null}
        </View>
        {isE2E ? (
          <View style={styles.e2eBar}>
            <Text style={styles.e2eText}>{t('SCORM: {text}', { text: notice || (busy ? t('Descargando...') : t('Listo')) })}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>{t('← Volver')}</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>{resource.title || t('SCORM')}</Text>
        <View style={styles.right} />
      </View>
      <WebView
        // El runtime inyectado captura `attemptId` en el load. Cuando se abre el
        // paquete, el primer render puede tener `attemptId=0` y si no se fuerza
        // el remount el commit quedaría encolado con attemptId=0.
        key={`${wrapperUri}:${attemptId || 0}`}
        ref={webRef}
        source={{ uri: wrapperUri }}
        originWhitelist={['file://*', 'http://*', 'https://*']}
        allowingReadAccessToURL={record?.localUri}
        allowFileAccess
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        javaScriptEnabled
        injectedJavaScriptBeforeContentLoaded={injected}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data) as any;
            if (msg?.type === 'atora.pageText' && typeof msg.text === 'string') {
              setPageText(msg.text.slice(0, 160));
              return;
            }
            if (msg?.type === 'atora.escapeCheck' && msg && typeof msg === 'object') {
              const parentOk = Boolean(msg.parentOk);
              const otherOk = Boolean(msg.otherOk);
              setEscapeCheckText(parentOk || otherOk ? 'ESCAPE:FAIL' : 'ESCAPE:OK');
              return;
            }
            if (msg?.type === 'scorm.commit' && typeof msg.attemptId === 'number' && msg.values && typeof msg.values === 'object') {
              // `attemptId` puede quedar en 0 si el runtime se inyectó antes
              // de que el estado nativo terminara de resolver el intento.
              // El attemptId del estado nativo es la fuente de verdad.
              const effectiveAttemptId = Number(msg.attemptId || attemptId || 0);
              if (!effectiveAttemptId) return;

              // Snapshot local para reanudar sin conexión (el servidor valida el puntaje y estados).
              try {
                valuesRef.current = { ...valuesRef.current, ...(msg.values as Record<string, string>) };
                const path = statePathRef.current;
                if (path) void FileSystem.writeAsStringAsync(path, JSON.stringify(valuesRef.current)).catch(() => undefined);
              } catch {
                // Sin persistencia.
              }

              if (isE2E) {
                try {
                  const values = msg.values as Record<string, string>;
                  const status = String(values['cmi.core.lesson_status'] ?? values['cmi.completion_status'] ?? '').toLowerCase();
                  const score = String(values['cmi.core.score.raw'] ?? values['cmi.score.raw'] ?? '').trim();
                  const location = String(values['cmi.core.lesson_location'] ?? values['cmi.location'] ?? '').trim();
                  const parts: string[] = [];
                  if (status) parts.push(`STATUS:${status}`);
                  if (score) parts.push(`SCORE:${score}`);
                  if (location) parts.push(`LOC:${location.slice(0, 18)}`);
                  if (!parts.length) {
                    const keys = Object.keys(values).slice(0, 6);
                    if (keys.length) parts.push(`KEYS:${keys.join('|')}`);
                  }
                  setLastCommitText(parts.length ? `LOCAL:${parts.join(',')}` : '');
                } catch {
                  setLastCommitText('');
                }
              }

              void enqueueScormCommit(effectiveAttemptId, msg.values as Record<string, string>)
                // Siempre reflejar el estado local aunque no haya red.
                .then(() => refreshSyncNotice())
                // Si hay red, intentar enviar y luego refrescar estado de servidor.
                .then(async () => {
                  const online = await hasNetwork();
                  if (!online) return;
                  await flushOutbox(token).catch(() => undefined);
                  await refreshServerState(effectiveAttemptId);
                  await refreshSyncNotice();
                })
                .catch(() => undefined);
            }
          } catch {
            // Mensaje ajeno.
          }
        }}
        onLoadEnd={() => undefined}
        onShouldStartLoadWithRequest={({ url }) => {
          if (url === 'about:blank') return true;
          if (url.startsWith('file://')) {
            const base = record?.localUri ?? '';
            return base ? isAllowedScormFileUrl(url, base) : true;
          }
          if (/^http:\/\//i.test(url)) {
            // Solo el server local del paquete.
            const origin = serverOriginRef.current;
            const tok = serverTokenRef.current;
            if (origin && tok && url.startsWith(`${origin}/${tok}/`)) return true;
            void Linking.openURL(url).catch(() => undefined);
            return false;
          }
          if (/^https?:\/\//i.test(url)) {
            void Linking.openURL(url).catch(() => undefined);
          }
          return false;
        }}
      />
      {isE2E ? (
        <View style={styles.e2eBar}>
          <Text style={styles.e2eText}>{t('SCORM: {text}', { text: [pageText || t('Cargando...'), escapeCheckText, serverStateText, lastCommitText].filter(Boolean).join(' · ') })}</Text>
        </View>
      ) : null}
      {syncNotice ? (
        <View style={styles.syncBar}>
          <Text style={styles.syncText}>{syncNotice}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },
  back: { color: colors.blue, fontWeight: '800' },
  title: { flex: 1, color: colors.navy, fontWeight: '900' },
  right: { width: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  notice: { color: colors.muted, textAlign: 'center' },
  button: { backgroundColor: colors.blue, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 10 },
  buttonText: { color: colors.paper, fontWeight: '900' },
  syncBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#fff3cd' },
  syncText: { color: colors.navy, fontWeight: '700', textAlign: 'center' },
  e2eBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: '#e7f3ff' },
  e2eText: { color: colors.navy, fontWeight: '700', fontSize: 12 },
});

