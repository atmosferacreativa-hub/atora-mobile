import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApiBaseUrlSync, getSiteBaseUrlSync, setApiBaseUrl } from '../runtimeConfig';
import { academyApiBase, normalizeAcademyUrl } from '../academy/url';
import { colors, spacing } from '../theme';
import { t } from '../i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
};

// Solo en desarrollo: en la app publicada no se ofrecen direcciones internas (1.0.0).
const presets = __DEV__
  ? [
      { label: 'ATORA Lab (LAN)', value: 'http://192.168.1.16:8080' }, // i18n-ignore (solo desarrollo)
      { label: 'Localhost (emulador)', value: 'http://localhost:8080' }, // i18n-ignore (solo desarrollo)
    ]
  : [];

/** 1.0.1: la dirección es de una academia ATORA solo si responde `/discovery`. Nada se guarda antes. */
async function isAcademy(apiBase: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${apiBase}/discovery`, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return false;
    const payload = (await response.json().catch(() => null)) as { api?: unknown; product?: unknown } | null;
    return Boolean(payload && typeof payload === 'object' && (payload.api === 'atora-mobile/v1' || payload.product === 'ATORA LMS'));
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function AcademyEndpointModal({ visible, onClose }: Props) {
  const [value, setValue] = useState(getSiteBaseUrlSync());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const site = useMemo(() => normalizeAcademyUrl(value), [value]);

  useEffect(() => {
    if (!visible) return;
    setValue(getSiteBaseUrlSync());
    setError('');
  }, [visible]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      // 1.0.1: se corrige la dirección (https;// → https://…) y solo se guarda si responde como academia.
      if (!site || !(await isAcademy(academyApiBase(site)))) {
        setError(t('No encontramos una academia en esa dirección'));
        return;
      }
      setValue(site);
      await setApiBaseUrl(academyApiBase(site));
      onClose();
    } catch {
      setError(t('No pudimos guardar la academia. Revisa la URL y tu red.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('Configurar academia')}</Text>
            <Pressable hitSlop={12} accessibilityRole="button" onPress={onClose}>
              <Text style={styles.close}>{t('Cerrar')}</Text>
            </Pressable>
          </View>

          <Text style={styles.help}>
            {t('Pega la URL del sitio (ej. {example}) y la app completará el endpoint REST automáticamente.', { example: 'https://academia.ejemplo.com' })}
          </Text>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setValue}
            placeholder="https://tuacademia.com"
            style={styles.input}
            value={value}
          />
          <Text style={styles.preview} testID="academy-url-preview">{t('Dirección: {url}', { url: site || '—' })}</Text>

          <View style={styles.presets}>
            {presets.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setValue(item.value)}
                style={styles.preset}
              >
                <Text style={styles.presetText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void save()}
            style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
          >
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('Guardar')}</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.backdrop, flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: spacing.md, padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: colors.navy, fontSize: 18, fontWeight: '900' },
  close: { color: colors.blue, fontWeight: '800' },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 15, padding: spacing.md },
  preview: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: { minHeight: 44, justifyContent: 'center', borderColor: colors.blue, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 8 },
  presetText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  error: { color: colors.red, fontSize: 13 },
  button: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 12, minHeight: 52, justifyContent: 'center' },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '900' },
});
