import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { AcademyEndpointModal } from '../components/AcademyEndpointModal';
import {
  clearAllDownloads,
  getDownloadSettings,
  getStorageSummary,
  updateDownloadSettings,
  type DownloadSettings,
  type StorageSummary,
} from '../offline/mediaDownloads';
import { getApiBaseUrlSync, getSiteBaseUrlSync } from '../runtimeConfig';
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
  const [setupOpen, setSetupOpen] = useState(false);
  const apiBaseUrl = getApiBaseUrlSync();
  const siteBaseUrl = getSiteBaseUrlSync();

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
      <AcademyEndpointModal visible={setupOpen} onClose={() => setSetupOpen(false)} />
      <Text style={styles.title}>{displayName || 'Perfil'}</Text>
      {email ? <Text style={styles.email}>{email}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.heading}>Academia</Text>
        <Text style={styles.help}>URL usada para conectar con tu entorno (ATORA Lab / producción).</Text>
        <Pressable accessibilityRole="button" onPress={() => setSetupOpen(true)} style={styles.academyButton}>
          <Text style={styles.academyValue} numberOfLines={1}>
            {apiBaseUrl ? apiBaseUrl : 'Configurar URL de la academia'}
          </Text>
          <Text style={styles.academyEdit}>Editar</Text>
        </Pressable>
        {siteBaseUrl ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openURL(`${siteBaseUrl}/panel-estudiante/`)}
            style={styles.panelButton}
          >
            <Text style={styles.panelText}>Abrir panel estudiante (web)</Text>
          </Pressable>
        ) : null}
      </View>

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
  academyButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md },
  academyValue: { color: colors.navy, flex: 1, fontSize: 13, fontWeight: '800' },
  academyEdit: { color: colors.blue, fontWeight: '900', marginLeft: spacing.md },
  panelButton: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 12, minHeight: 46, justifyContent: 'center', padding: spacing.md },
  panelText: { color: colors.white, fontWeight: '900' },
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
