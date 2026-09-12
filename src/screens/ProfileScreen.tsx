import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  clearAllDownloads,
  getDownloadSettings,
  getStorageSummary,
  updateDownloadSettings,
  type DownloadSettings,
  type StorageSummary,
} from '../offline/mediaDownloads';
import { colors, spacing } from '../theme';

type Props = {
  displayName: string;
  email?: string;
  onLogout: () => void;
};

const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function ProfileScreen({ displayName, email, onLogout }: Props) {
  const [settings, setSettings] = useState<DownloadSettings | null>(null);
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const [nextSettings, nextSummary] = await Promise.all([
      getDownloadSettings(),
      getStorageSummary(),
    ]);
    setSettings(nextSettings);
    setSummary(nextSummary);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changeSetting = async (values: Partial<DownloadSettings>) => {
    setBusy(true);
    setNotice('');
    try {
      setSettings(await updateDownloadSettings(values));
      setSummary(await getStorageSummary());
    } catch {
      setNotice('No pudimos actualizar la configuración.');
    } finally {
      setBusy(false);
    }
  };

  const clearDownloads = async () => {
    setBusy(true);
    setNotice('');
    try {
      await clearAllDownloads();
      await refresh();
      setNotice('Contenido descargado eliminado.');
    } catch {
      setNotice('No pudimos liberar el almacenamiento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{displayName || 'Perfil'}</Text>
      {email ? <Text style={styles.email}>{email}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.heading}>Descargas y datos</Text>
        {!settings || !summary ? <ActivityIndicator color={colors.blue} /> : (
          <>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.label}>Descargar solo con Wi-Fi</Text>
                <Text style={styles.help}>Evita consumo accidental de datos móviles.</Text>
              </View>
              <Switch
                disabled={busy}
                onValueChange={(value) => void changeSetting({ wifiOnly: value })}
                value={settings.wifiOnly}
              />
            </View>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.label}>Modo ahorro de datos</Text>
                <Text style={styles.help}>Mantiene el streaming como opción secundaria.</Text>
              </View>
              <Switch
                disabled={busy}
                onValueChange={(value) => void changeSetting({ lowDataMode: value })}
                value={settings.lowDataMode}
              />
            </View>
            <Text style={styles.storage}>
              {summary.count} archivos · {formatMegabytes(summary.usedBytes)} de {formatMegabytes(summary.maxBytes)}
            </Text>
            <Text style={styles.help}>Las descargas sin uso se eliminan después de {settings.retentionDays} días.</Text>
            {summary.count > 0 ? (
              <Pressable disabled={busy} onPress={() => void clearDownloads()} style={styles.clearButton}>
                <Text style={styles.clearText}>Eliminar todas las descargas</Text>
              </Pressable>
            ) : null}
          </>
        )}
        {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      </View>

      <Pressable accessibilityRole="button" onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  title: { color: colors.navy, fontSize: 28, fontWeight: '800' },
  email: { color: colors.muted, fontSize: 15 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: spacing.md, padding: spacing.md },
  heading: { color: colors.navy, fontSize: 20, fontWeight: '800' },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  rowText: { flex: 1 },
  label: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  storage: { color: colors.blue, fontWeight: '800' },
  clearButton: { alignItems: 'center', borderColor: colors.red, borderRadius: 12, borderWidth: 1, padding: spacing.md },
  clearText: { color: colors.red, fontWeight: '800' },
  notice: { color: colors.muted, textAlign: 'center' },
  logoutButton: { alignItems: 'center', borderColor: colors.red, borderRadius: 12, borderWidth: 1, padding: spacing.md },
  logoutText: { color: colors.red, fontWeight: '800' },
});
