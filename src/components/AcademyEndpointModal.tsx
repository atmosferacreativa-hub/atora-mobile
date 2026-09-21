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
import { ApiError, apiRequest } from '../api/client';
import { getApiBaseUrlSync, normalizeApiBaseUrl, setApiBaseUrl } from '../runtimeConfig';
import { colors, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const presets = [
  { label: 'ATORA Lab (LAN)', value: 'http://192.168.1.16:8080' },
  { label: 'Localhost (emulador)', value: 'http://localhost:8080' },
];

async function probeNamespace(): Promise<void> {
  // Validación: el namespace de ATORA Mobile debe existir y responder 200.
  const baseUrl = getApiBaseUrlSync();
  const response = await fetch(baseUrl, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new ApiError('No pudimos validar el endpoint de la academia.', response.status, 'invalid_endpoint');
  }
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || (payload as { namespace?: string }).namespace === undefined) {
    throw new ApiError('La academia respondió en un formato inesperado.', response.status, 'invalid_json');
  }
}

export function AcademyEndpointModal({ visible, onClose }: Props) {
  const current = getApiBaseUrlSync();
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const normalized = useMemo(() => normalizeApiBaseUrl(value), [value]);

  useEffect(() => {
    if (!visible) return;
    setValue(getApiBaseUrlSync());
    setError('');
  }, [visible]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await setApiBaseUrl(value);
      // Probar conectividad con el endpoint ya guardado.
      if (normalized) {
        await probeNamespace();
      }
      onClose();
    } catch (reason) {
      if (reason instanceof ApiError) {
        setError(reason.code ? `${reason.message} [${reason.code}]` : reason.message);
      } else {
        setError('No pudimos guardar la academia. Revisa la URL y tu red.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Configurar academia</Text>
            <Pressable accessibilityRole="button" onPress={onClose}>
              <Text style={styles.close}>Cerrar</Text>
            </Pressable>
          </View>

          <Text style={styles.help}>
            Pega la URL del sitio (ej. `http://192.168.1.16:8080`) y la app completará el endpoint REST automáticamente.
          </Text>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setValue}
            placeholder="http://tusitio.com"
            style={styles.input}
            value={value}
          />
          <Text style={styles.preview}>Endpoint: {normalized || '—'}</Text>

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
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Guardar</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: spacing.md, padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: colors.navy, fontSize: 18, fontWeight: '900' },
  close: { color: colors.blue, fontWeight: '800' },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 15, padding: spacing.md },
  preview: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: { borderColor: colors.blue, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 8 },
  presetText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  error: { color: colors.red, fontSize: 13 },
  button: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 12, minHeight: 52, justifyContent: 'center' },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '900' },
});
