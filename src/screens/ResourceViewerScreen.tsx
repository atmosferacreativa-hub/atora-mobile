import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { VIEWER_ROOT, viewerUrl } from '../viewer/files';
import { colors, spacing } from '../theme';
import { t } from '../i18n';

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

  useEffect(() => {
    let active = true;
    viewerUrl(kind, localUri)
      .then((url) => { if (active) setSource(url); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [kind, localUri]);

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>{t('← Volver')}</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
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
          source={{ uri: source }}
          originWhitelist={['file://*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={VIEWER_ROOT}
          javaScriptEnabled={kind !== 'html'}
          setBuiltInZoomControls={kind === 'image'}
          setDisplayZoomControls={false}
          onError={() => setFailed(true)}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data) as { type: string };
              if (message.type === 'error') setFailed(true);
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
  web: { backgroundColor: colors.ink, flex: 1 },
  center: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  error: { color: colors.white, textAlign: 'center' },
  button: { backgroundColor: colors.mustard, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  buttonText: { color: colors.navy, fontWeight: '900' },
});
