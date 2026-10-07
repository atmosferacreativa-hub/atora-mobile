import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchThreads } from '../api/messages';
import { subscribeOutbox } from '../offline/outbox/runtime';
import { EmptyState } from '../components/ui';
import { colors, radius, spacing } from '../theme';
import type { MessageThread, ThreadsResponse } from '../types';
import { locale, t } from '../i18n';

type Props = {
  token: string;
  canCompose: boolean;
  onOpenThread: (thread: MessageThread) => void;
  onCompose: () => void;
  /** Explicación previa para activar avisos en el teléfono (nunca se pide el permiso sin contexto). */
  pushPrompt?: React.ReactNode;
};

export function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

function ThreadRow({ thread, pinned, onPress }: { thread: MessageThread; pinned?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, pinned && styles.pinned]}>
      <View style={[styles.avatar, pinned && styles.avatarPinned]}>
        <Ionicons name={pinned ? 'notifications-outline' : 'chatbubble-ellipses-outline'} size={20} color={pinned ? colors.accentText : colors.primary} />
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowHead}>
          <Text numberOfLines={1} style={[styles.rowTitle, thread.unread > 0 && styles.bold]}>{thread.title}</Text>
          <Text style={styles.when}>{formatWhen(thread.last_message_at)}</Text>
        </View>
        <View style={styles.rowHead}>
          <Text numberOfLines={1} style={styles.preview}>
            {thread.last_message ? `${thread.last_message.mine ? t('Tú: ') : ''}${thread.last_message.preview}` : pinned ? t('Sin avisos todavía.') : ''}
          </Text>
          {thread.unread > 0 ? <Text style={styles.badge}>{thread.unread > 99 ? '99+' : thread.unread}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Mensajes (0.6.0): "Avisos" fijo arriba y las conversaciones. */
export function MessagesScreen({ token, canCompose, onOpenThread, onCompose, pushPrompt }: Props) {
  const [data, setData] = useState<ThreadsResponse | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchThreads(token);
      setData(result.data);
      setSyncedAt(result.syncedAt);
      setFromCache(result.fromCache);
      setError('');
    } catch {
      setError(t('No pudimos cargar tus mensajes. Conéctate para sincronizarlos.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  // Un mensaje que se envió desde la cola actualiza la lista.
  useEffect(() => subscribeOutbox(() => void load()), [load]);

  if (!data && !error) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('Mensajes')}</Text>
        {canCompose ? (
          <Pressable accessibilityRole="button" onPress={onCompose} style={styles.compose}>
            <Ionicons name="create-outline" size={18} color={colors.white} />
            <Text style={styles.composeText}>{t('Escribir')}</Text>
          </Pressable>
        ) : null}
      </View>
      {fromCache && syncedAt ? <Text style={styles.sync}>{t('Sin conexión · actualizado el {date}', { date: new Date(syncedAt).toLocaleString(locale()) })}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {pushPrompt}
      {data ? <ThreadRow thread={data.avisos} pinned onPress={() => onOpenThread(data.avisos)} /> : null}
      {data?.threads.map((thread) => <ThreadRow key={thread.id} thread={thread} onPress={() => onOpenThread(thread)} />)}
      {data && !data.threads.length ? (
        <EmptyState icon="chatbubbles-outline" title={t('Sin conversaciones')} description={canCompose ? t('Escribe a tus docentes con el botón Escribir.') : t('Las conversaciones con tus estudiantes aparecerán aquí.')} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.sm, padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  compose: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.pill, flexDirection: 'row', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  composeText: { color: colors.white, fontWeight: '800' },
  sync: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.danger },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  pinned: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  avatar: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  avatarPinned: { backgroundColor: colors.white },
  rowText: { flex: 1, gap: 2 },
  rowHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  rowTitle: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '700' },
  bold: { fontWeight: '900' },
  when: { color: colors.textMuted, fontSize: 12 },
  preview: { color: colors.textMuted, flex: 1, fontSize: 13 },
  badge: { backgroundColor: colors.primary, borderRadius: radius.pill, color: colors.white, fontSize: 11, fontWeight: '900', minWidth: 22, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, textAlign: 'center' },
});
