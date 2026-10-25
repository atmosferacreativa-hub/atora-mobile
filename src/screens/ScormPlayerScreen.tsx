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
import { flushOutbox, listOutbox, subscribeOutbox } from '../offline/outbox/runtime';
import { formatBytes } from '../offline/downloadsMath';
import { buildScormInjectedRuntime } from '../scorm/runtime';
import { isAllowedScormFileUrl } from '../scorm/urls';
import { mergeScormValues } from '../scorm/values';
import { startLocalScormServer } from '../scorm/localServer';

type Props = {
  token: string;
  lessonId: number;
  courseId: number;
  resource: LessonResource;
  onBack: () => void;
};

/** Reproductor SCORM (1.1.0) desde archivos locales, con commits vía outbox. */
export function ScormPlayerScreen({ token, lessonId, courseId, resource, onBack }: Props) {
  const webRef = useRef<WebView>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState<DownloadRecord | null>(null);
  const [source, setSource] = useState('');
  const [pageText, setPageText] = useState('');
  const [escapeCheckText, setEscapeCheckText] = useState('');
  const [attemptId, setAttemptId] = useState(0);
  const [syncError, setSyncError] = useState('');
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
              setSource(`${server.origin}/${server.token}/${pending.launchPath}`);
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

  const refreshSyncError = useCallback(async () => {
    if (!attemptId) {
      setSyncError('');
      return;
    }
    const all = await listOutbox().catch(() => ({ pending: [], failed: [] }));
    const mine = all.failed.filter((event) => event.type === SCORM_COMMIT && (event.payload as any)?.attemptId === attemptId);
    setSyncError(mine.length ? t('Último intento: {error}', { error: mine[0]!.lastError || t('Error desconocido') }) : '');
  }, [attemptId]);

  useEffect(() => {
    void refreshSyncError();
    return subscribeOutbox(() => void refreshSyncError());
  }, [refreshSyncError]);

  const openFromRecord = useCallback(async (saved: DownloadRecord) => {
    const base = saved.localUri;
    const complete = await FileSystem.getInfoAsync(`${base}.atora-complete`).catch(() => ({ exists: false } as any));
    if (!complete.exists) throw new Error(t('La descarga del paquete no está completa. Vuelve a descargarlo.'));
    const href = saved.scorm?.launchHref || launchHref;
    if (!href) throw new Error(t('El paquete SCORM no tiene launch file.'));
    const localUri = `${base}${href.replace(/^\//, '')}`;
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
    androidServeRef.current = { packageDir: base, launchPath };

    // Android: algunos paquetes (Rise/Storyline) usan XHR/fetch y fallan con file://.
    // Se sirven desde 127.0.0.1 con puerto aleatorio y token (carpeta) en la ruta.
    if (Platform.OS === 'android') {
      if (!serverRef.current) {
        const server = await startLocalScormServer(base);
        serverRef.current = { stop: server.stop };
        serverOriginRef.current = server.origin;
        serverTokenRef.current = server.token;
      }
      const origin = serverOriginRef.current;
      const tok = serverTokenRef.current;
      setSource(`${origin}/${tok}/${launchPath}`);
      return;
    }

    setSource(localUri);
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

  if (!source) {
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
        ref={webRef}
        source={{ uri: source }}
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
              // Snapshot local para reanudar sin conexión (el servidor valida el puntaje y estados).
              try {
                valuesRef.current = { ...valuesRef.current, ...(msg.values as Record<string, string>) };
                const path = statePathRef.current;
                if (path) void FileSystem.writeAsStringAsync(path, JSON.stringify(valuesRef.current)).catch(() => undefined);
              } catch {
                // Sin persistencia.
              }
              void enqueueScormCommit(msg.attemptId, msg.values as Record<string, string>)
                .then(() => flushOutbox(token))
                .then(() => refreshSyncError())
                .catch(() => undefined);
            }
          } catch {
            // Mensaje ajeno.
          }
        }}
        onLoadEnd={() => {
          if (!isE2E) return;
          try {
            webRef.current?.injectJavaScript(`
              (function(){
                try {
                  var title = (document && document.title) ? String(document.title).replace(/\s+/g,' ').trim() : '';
                  var body = (document && document.body && document.body.innerText) ? String(document.body.innerText).replace(/\s+/g,' ').trim() : '';
                  var text = (title ? (title + ' — ') : '') + body;
                  text = String(text || '').trim().slice(0, 220);
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'atora.pageText', text: text || '(sin texto)' }));
                } catch(e) {}

                // Hardening: no permitir escapar a carpeta padre ni acceder a "otro paquete".
                // Desde /{token}/index.html, ../ resuelve a / (raíz). Debe fallar.
                // También probamos /{token}x/... como si fuese otro paquete.
                try {
                  var seg = (location && location.pathname) ? String(location.pathname).split('/').filter(Boolean)[0] : '';
                  var other = seg ? (seg + 'x') : 'other';
                  Promise.all([
                    fetch('../').then(function(r){return r && r.ok;}).catch(function(){return false;}),
                    fetch('/' + other + '/index.html').then(function(r){return r && r.ok;}).catch(function(){return false;}),
                  ]).then(function(res){
                    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'atora.escapeCheck', parentOk: !!res[0], otherOk: !!res[1] }));
                  });
                } catch(e) {}
              })();
              true;
            `);
          } catch {
            // Sin ref.
          }
        }}
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
          <Text style={styles.e2eText}>{t('SCORM: {text}', { text: [pageText || t('Cargando...'), escapeCheckText].filter(Boolean).join(' · ') })}</Text>
        </View>
      ) : null}
      {syncError ? (
        <View style={styles.syncBar}>
          <Text style={styles.syncText}>{syncError}</Text>
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

