import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AcademyEndpointModal } from '../components/AcademyEndpointModal';
import { MediaImage } from '../components/MediaImage';
import { Button, Card } from '../components/ui';
import {
  clearAllDownloads,
  getDownloadSettings,
  getStorageSummary,
  listDownloads,
  updateDownloadSettings,
  type DownloadRecord,
  type DownloadSettings,
  type StorageSummary,
} from '../offline/mediaDownloads';
import { dismissOutboxEvent, listOutbox, subscribeOutbox } from '../offline/outbox/runtime';
import type { OutboxEvent } from '../offline/outbox/types';
import { getApiBaseUrlSync, getSiteBaseUrlSync } from '../runtimeConfig';
import type { AppMode } from '../navigation/roles';
import { colors, spacing } from '../theme';

type Props = {
  displayName: string;
  email?: string;
  onLogout: () => void;
  mode?: AppMode;
  /** Solo para docentes que también tienen matrículas como estudiante. */
  onSwitchMode?: (mode: AppMode) => void;
  /** 0.4.0: pantalla de descargas agrupada por curso. */
  onOpenDownloads?: () => void;
  /** 0.5.0: evolución académica y certificados (solo si el servidor los ofrece). */
  onOpenEvolution?: () => void;
  newGrades?: number;
  onOpenCertificates?: () => void;
  /** 0.6.0: avisos en el teléfono (explicación, permiso y preferencias por tipo). */
  notificationSettings?: React.ReactNode;
};

const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const EVENT_LABELS: Record<string, string> = {
  lesson_completion: 'Lección completada',
  assignment_submission: 'Entrega de tarea',
  playback_position: 'Posición del video',
};

export function ProfileScreen({ displayName, email, onLogout, mode, onSwitchMode, onOpenDownloads, onOpenEvolution, newGrades = 0, onOpenCertificates, notificationSettings }: Props) {
  const [settings, setSettings] = useState<DownloadSettings | null>(null);
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [outbox, setOutbox] = useState<{ pending: OutboxEvent[]; failed: OutboxEvent[] }>({ pending: [], failed: [] });
  const apiBaseUrl = getApiBaseUrlSync();

  useEffect(() => {
    const load = () => void listOutbox().then(setOutbox).catch(() => undefined);
    load();
    return subscribeOutbox(load);
  }, []);

  const confirmLogout = () => {
    if (!outbox.pending.length) {
      onLogout();
      return;
    }
    Alert.alert(
      'Tienes envíos pendientes',
      `${outbox.pending.length} envío(s) todavía no llegaron a la academia. Si cierras sesión sin conexión, se perderán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: onLogout },
      ],
    );
  };
  const siteBaseUrl = getSiteBaseUrlSync();

  const refresh = useCallback(async () => {
    const [nextSettings, nextSummary, nextDownloads] = await Promise.all([
      getDownloadSettings(),
      getStorageSummary(),
      listDownloads(),
    ]);
    setSettings(nextSettings);
    setSummary(nextSummary);
    setDownloads(nextDownloads);
  }, []);

  // Al volver de la pantalla de descargas, el uso de almacenamiento cambió.
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

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

      {onOpenEvolution ? (
        <Pressable accessibilityRole="button" onPress={onOpenEvolution} style={styles.panelButton}>
          <Text style={styles.panelText}>Mi evolución y notas{newGrades ? ` · ${newGrades} nueva${newGrades === 1 ? '' : 's'}` : ''}</Text>
        </Pressable>
      ) : null}
      {onOpenCertificates ? (
        <Pressable accessibilityRole="button" onPress={onOpenCertificates} style={styles.panelButton}>
          <Text style={styles.panelText}>Mis certificados</Text>
        </Pressable>
      ) : null}

      {notificationSettings ? (
        <Card>
          <Text style={styles.heading}>Avisos en el teléfono</Text>
          {notificationSettings}
        </Card>
      ) : null}

      {outbox.pending.length || outbox.failed.length ? (
        <Card>
          <Text style={styles.heading}>Sincronización</Text>
          {outbox.pending.length ? (
            <Text style={styles.help}>
              {outbox.pending.length} envío(s) guardado(s). Se enviarán solos cuando tengas conexión.
            </Text>
          ) : null}
          {outbox.failed.map((event) => (
            <View key={event.id} style={styles.failedItem}>
              <Text style={styles.label}>{EVENT_LABELS[event.type] ?? 'Envío'}: no se pudo enviar</Text>
              <Text style={styles.help}>{event.lastError}</Text>
              <Pressable accessibilityRole="button" onPress={() => void dismissOutboxEvent(event.id)}>
                <Text style={styles.academyEdit}>Descartar</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      {onSwitchMode ? (
        <Card>
          <Text style={styles.heading}>Modo</Text>
          <Text style={styles.help}>
            {mode === 'teacher' ? 'Estás viendo la app como docente.' : 'Estás viendo la app como estudiante.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSwitchMode(mode === 'teacher' ? 'student' : 'teacher')}
            style={styles.panelButton}
          >
            <Text style={styles.panelText}>{mode === 'teacher' ? 'Cambiar a modo estudiante' : 'Cambiar a modo docente'}</Text>
          </Pressable>
        </Card>
      ) : null}

      <Card>
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
      </Card>

      <Card>
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
            {onOpenDownloads ? (
              <Pressable accessibilityRole="button" onPress={onOpenDownloads} style={styles.panelButton}>
                <Text style={styles.panelText}>Ver descargas por curso</Text>
              </Pressable>
            ) : downloads.map((record) => (
              <View key={record.localUri} style={styles.downloadItem}>
                <MediaImage play style={styles.downloadThumb} uri={record.thumbnailUrl} />
                <View style={styles.rowText}>
                  <Text numberOfLines={2} style={styles.label}>{record.title || `Lección ${record.lessonId}`}</Text>
                  <Text style={styles.help}>{formatMegabytes(record.size)}</Text>
                </View>
              </View>
            ))}
            {summary.count > 0 ? (
              <Pressable disabled={busy} onPress={() => void clearDownloads()} style={styles.clearButton}>
                <Text style={styles.clearText}>Eliminar todas las descargas</Text>
              </Pressable>
            ) : null}
          </>
        )}
        {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      </Card>

      <Button label="Cerrar sesión" onPress={confirmLogout} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  title: { color: colors.navy, fontSize: 28, fontWeight: '800' },
  email: { color: colors.muted, fontSize: 15 },
  heading: { color: colors.navy, fontSize: 20, fontWeight: '800' },
  academyButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md },
  academyValue: { color: colors.navy, flex: 1, fontSize: 13, fontWeight: '800' },
  academyEdit: { color: colors.blue, fontWeight: '900', marginLeft: spacing.md },
  downloadItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  downloadThumb: { borderRadius: 8, width: 96 },
  failedItem: { borderTopColor: colors.border, borderTopWidth: 1, gap: 4, paddingTop: spacing.sm },
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
});
