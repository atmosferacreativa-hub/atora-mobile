import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import type { LessonResource } from '../types';
import { colors, spacing } from '../theme';
import { t } from '../i18n';
import { downloadScormPackage, findScormDownload, updateScormDownloadAttemptId, type DownloadRecord } from '../offline/mediaDownloads';
import { enqueueScormCommit, isScormNoAttemptsError, scormGetValues, startScormAttempt, SCORM_COMMIT } from '../api/scorm';
import { flushOutbox, listOutbox, subscribeOutbox } from '../offline/outbox/runtime';
import { formatBytes } from '../offline/downloadsMath';

type Props = {
  token: string;
  lessonId: number;
  courseId: number;
  resource: LessonResource;
  onBack: () => void;
};

function scormInjectedRuntime(attemptId: number, scormVersion: string, initialValues: Record<string, string>): string {
  const payload = JSON.stringify({ attemptId, scormVersion, initialValues });
  return `
    (function(){
      try {
        var cfg = ${payload};
        var attemptId = cfg.attemptId || 0;
        var version = (cfg.scormVersion || '').toString();
        var initial = cfg.initialValues || {};
        var cmi = Object.assign({}, initial);
        var buffer = {};
        var lastError = '0';
        function post(msg){
          try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {}
        }
        function flush(){
          try {
            var keys = Object.keys(buffer);
            if (!keys.length) return 'true';
            var values = {};
            keys.forEach(function(k){ values[k] = String(buffer[k]); });
            buffer = {};
            post({ type: 'scorm.commit', attemptId: attemptId, values: values });
            return 'true';
          } catch(e) { lastError = '101'; return 'false'; }
        }
        function getValue(key){
          key = String(key || '');
          return Object.prototype.hasOwnProperty.call(cmi, key) ? String(cmi[key]) : '';
        }
        function setValue(key, value){
          key = String(key || '');
          if (!key) { lastError = '201'; return 'false'; }
          var v = value === null || value === undefined ? '' : String(value);
          cmi[key] = v;
          buffer[key] = v;
          lastError = '0';
          return 'true';
        }
        function init(){ lastError = '0'; post({ type: 'scorm.init', attemptId: attemptId, version: version }); return 'true'; }
        function term(){ flush(); post({ type: 'scorm.terminate', attemptId: attemptId }); lastError = '0'; return 'true'; }
        function error(){ return String(lastError || '0'); }
        function errorString(code){ return String(code || '0'); }
        function diag(code){ return String(code || '0'); }

        if (version === '2004') {
          window.API_1484_11 = {
            Initialize: init,
            Terminate: term,
            Commit: flush,
            GetValue: getValue,
            SetValue: setValue,
            GetLastError: error,
            GetErrorString: errorString,
            GetDiagnostic: diag,
          };
        } else {
          window.API = {
            LMSInitialize: init,
            LMSFinish: term,
            LMSCommit: flush,
            LMSGetValue: getValue,
            LMSSetValue: setValue,
            LMSGetLastError: error,
            LMSGetErrorString: errorString,
            LMSGetDiagnostic: diag,
          };
        }
        post({ type: 'scorm.ready', attemptId: attemptId, version: version });
      } catch(e) {}
    })();
    true;
  `;
}

/** Reproductor SCORM (1.1.0) desde archivos locales, con commits vía outbox. */
export function ScormPlayerScreen({ token, lessonId, courseId, resource, onBack }: Props) {
  const webRef = useRef<WebView>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState<DownloadRecord | null>(null);
  const [source, setSource] = useState('');
  const [attemptId, setAttemptId] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const valuesRef = useRef<Record<string, string>>({});

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
        if (resolvedAttemptId) {
          await updateScormDownloadAttemptId(saved.resourceKey, resolvedAttemptId).catch(() => undefined);
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

    const statePath = `${base}.atora-cmi.json`;
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
        values = { ...localValues, ...server.values };
        await FileSystem.writeAsStringAsync(statePath, JSON.stringify(values)).catch(() => undefined);
      }
    }

    valuesRef.current = values;
    setInitialValues(values);
    setSource(localUri);
  }, [hasNetwork, launchHref, token]);

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

  const injected = useMemo(() => scormInjectedRuntime(attemptId, scormVersion || '1.2', initialValues), [attemptId, scormVersion, initialValues]);

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
            if (msg?.type === 'scorm.commit' && typeof msg.attemptId === 'number' && msg.values && typeof msg.values === 'object') {
              // Snapshot local para reanudar sin conexión (el servidor valida el puntaje y estados).
              try {
                valuesRef.current = { ...valuesRef.current, ...(msg.values as Record<string, string>) };
                const path = record?.localUri ? `${record.localUri}.atora-cmi.json` : '';
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
        onShouldStartLoadWithRequest={({ url }) => {
          if (url === 'about:blank') return true;
          if (url.startsWith('file://')) {
            const base = record?.localUri ?? '';
            return base ? url.startsWith(base) : true;
          }
          if (/^https?:\/\//i.test(url)) {
            void Linking.openURL(url).catch(() => undefined);
          }
          return false;
        }}
      />
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
});

