import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as FileSystem from 'expo-file-system/legacy';
import { VIEWER_ROOT, viewerUrlWithOptions } from '../viewer/files';
import { colors, spacing } from '../theme';
import { t } from '../i18n';
import { isOnlineCacheUri } from '../offline/onlineCache';

type Props = {
  title: string;
  localUri: string;
  kind: 'pdf' | 'image' | 'html';
  onBack: () => void;
  onOpenWithSystem: () => void;
};

/** Visor de PDF (pdf.js) e imágenes con zoom, desde el archivo descargado. Funciona sin conexión. */
export function ResourceViewerScreen({ title, localUri, kind, onBack, onOpenWithSystem }: Props) {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);
  // 1.0.0+: la primera página ya se ve (lo esperan las pruebas de pantalla).
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const webRef = useRef<WebView>(null);

  const showZoomControls = kind === 'pdf' || kind === 'image';
  const canZoomOut = zoom > 1.01;
  const canZoomIn = zoom < 4.99;

  const initialZoom = useMemo(() => (kind === 'image' ? 1 : 1), [kind]);

  useEffect(() => {
    // Solo en visor: permitir landscape.
    void ScreenOrientation.unlockAsync().catch(() => undefined);
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (isOnlineCacheUri(localUri)) {
        void FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
      }
    };
  }, [localUri]);

  useEffect(() => {
    setReady(kind === 'html');
    let active = true;
    viewerUrlWithOptions(kind, localUri, { initialZoom })
      .then((url) => { if (active) setSource(url); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [kind, localUri, initialZoom]);

  const sendZoom = (op: 'in' | 'out' | 'fit') => {
    const js = `try{window.__atoraViewer&&window.__atoraViewer.${op === 'in' ? 'zoomIn' : op === 'out' ? 'zoomOut' : 'fitWidth'}&&window.__atoraViewer.${op === 'in' ? 'zoomIn' : op === 'out' ? 'zoomOut' : 'fitWidth'}();}catch(e){}`;
    webRef.current?.injectJavaScript(js);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>{t('← Volver')}</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {showZoomControls ? (
          <View style={styles.zoom}>
            <Pressable accessibilityRole="button" onPress={() => sendZoom('out')} disabled={!canZoomOut} hitSlop={10} style={styles.zoomBtnWrap}>
              <Text style={[styles.zoomBtn, !canZoomOut ? styles.zoomDisabled : null]}>A−</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => sendZoom('fit')} hitSlop={10} style={styles.zoomBtnWrap}>
              <Text style={styles.zoomBtn}>{t('Ajustar')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => sendZoom('in')} disabled={!canZoomIn} hitSlop={10} style={styles.zoomBtnWrap}>
              <Text style={[styles.zoomBtn, !canZoomIn ? styles.zoomDisabled : null]}>A+</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.error}>{t('No se pudo abrir el archivo aquí.')}</Text>
          <Pressable accessibilityRole="button" onPress={onOpenWithSystem} style={styles.button}>
            <Text style={styles.buttonText}>{t('Abrir con otra app')}</Text>
          </Pressable>
        </View>
      ) : source ? (
        <WebView
          ref={webRef}
          source={{ uri: source }}
          originWhitelist={['file://*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={VIEWER_ROOT}
          javaScriptEnabled={kind !== 'html'}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          onError={() => setFailed(true)}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data) as { type: string };
              if (message.type === 'error') setFailed(true);
              if (message.type === 'first-page') setReady(true);
              if (message.type === 'ready') setReady(true);
              if (message.type === 'zoom' && typeof (message as any).zoom === 'number') setZoom((message as any).zoom);
            } catch {
              // Mensaje ajeno.
            }
          }}
          onShouldStartLoadWithRequest={({ url }) => {
            if (url.startsWith('file://') || url === 'about:blank') return true;
            // Enlaces del documento (verificación, compartir): en el navegador.
            if (/^https?:\/\//i.test(url)) void Linking.openURL(url).catch(() => undefined);
            return false;
          }}
          startInLoadingState
          renderLoading={() => <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>}
          style={styles.web}
          testID={ready ? 'resource-ready' : 'resource-loading'}
        />
      ) : (
        <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.ink, flex: 1 },
  bar: { alignItems: 'center', backgroundColor: colors.surface, flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { color: colors.blue, fontWeight: '800' },
  title: { color: colors.navy, flex: 1, fontWeight: '900' },
  zoom: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  zoomBtnWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  zoomBtn: { color: colors.navy, fontWeight: '900' },
  zoomDisabled: { opacity: 0.35 },
  web: { backgroundColor: colors.ink, flex: 1 },
  center: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  error: { color: colors.white, textAlign: 'center' },
  button: { backgroundColor: colors.mustard, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  buttonText: { color: colors.navy, fontWeight: '900' },
});
