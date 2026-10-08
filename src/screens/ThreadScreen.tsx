import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchThread, markThreadRead, outgoingMessages, sendMessage, threadForEvent } from '../api/messages';
import { dismissOutboxEvent, flushOutbox, subscribeOutbox } from '../offline/outbox/runtime';
import { mergeOutgoing, type DisplayMessage, type OutgoingEvent } from '../messages/outgoing';
import { useNetworkState } from '../hooks/useNetworkState';
import { colors, radius, spacing } from '../theme';
import type { InboxMessage, InternalLink, MessageThread } from '../types';
import { formatWhen } from './MessagesScreen';
import { locale, t } from '../i18n';
// 1.0.1: la caja de escritura queda pegada al teclado (también con borde a borde).
import { useKeyboardInset } from '../hooks/useKeyboardInset';

type Props = {
  token: string;
  threadId?: number;
  /** Conversación nueva con un docente (aún sin hilo). */
  recipient?: { id: number; name: string; courseId?: number };
  title?: string;
  onBack: () => void;
  onOpenLink: (link: InternalLink) => void;
  onThreadCreated?: (threadId: number) => void;
};

/** Hilo (0.6.0): historial paginado, respuesta y estados pendiente / no se envió. */
export function ThreadScreen({ token, threadId, recipient, title, onBack, onOpenLink, onThreadCreated }: Props) {
  const frame = useRef<View>(null);
  const inset = useKeyboardInset(frame);
  const network = useNetworkState();
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(Boolean(threadId));
  const [error, setError] = useState('');
  const lastSent = useRef<string | null>(null);

  const load = useCallback(async () => {
    setOutgoing(await outgoingMessages());
    if (!threadId) return;
    try {
      const result = await fetchThread(threadId, token);
      setThread(result.data.thread);
      setMessages(result.data.messages);
      setNextBefore(result.data.next_before);
      setSyncedAt(result.syncedAt);
      setFromCache(result.fromCache);
      setError('');
      if (!result.fromCache && result.data.messages.some((message) => !message.read)) {
        void markThreadRead(threadId, token).catch(() => undefined);
      }
    } catch {
      setError(t('No pudimos abrir la conversación. Conéctate para verla por primera vez.'));
    } finally {
      setLoading(false);
    }
  }, [threadId, token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeOutbox(() => {
    void (async () => {
      setOutgoing(await outgoingMessages());
      // Conversación nueva: al confirmarse, el servidor dice cuál es su hilo.
      if (!threadId && onThreadCreated && lastSent.current) {
        const created = await threadForEvent(lastSent.current);
        if (created) onThreadCreated(created);
      }
      if (threadId) void load();
    })();
  }), [load, threadId, onThreadCreated]);

  const loadOlder = async () => {
    if (!threadId || !nextBefore) return;
    const result = await fetchThread(threadId, token, nextBefore).catch(() => null);
    if (!result) return;
    setMessages((current) => [...current, ...result.data.messages]);
    setNextBefore(result.data.next_before);
  };

  const send = async () => {
    const eventId = await sendMessage(threadId ? { threadId } : { recipientId: recipient?.id, courseId: recipient?.courseId }, text);
    if (!eventId) return;
    lastSent.current = eventId;
    setText('');
    setOutgoing(await outgoingMessages());
    if (!network.offline) {
      await flushOutbox(token).catch(() => undefined);
      if (!threadId && onThreadCreated) {
        const created = await threadForEvent(eventId);
        if (created) onThreadCreated(created);
      }
    }
  };

  const list: DisplayMessage[] = mergeOutgoing(messages, outgoing, threadId ?? -1, threadId ? undefined : recipient?.id);
  const canReply = recipient ? true : Boolean(thread?.can_reply);
  const heading = thread?.title ?? title ?? recipient?.name ?? 'Conversación';

  const renderItem = ({ item }: { item: DisplayMessage }) => {
    const mine = item.mine;
    return (
      <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : thread?.type === 'system' ? styles.bubbleNotice : styles.bubbleOther]}>
          {item.title ? <Text style={[styles.bubbleTitle, mine && styles.mineText]}>{item.title}</Text> : null}
          {item.body ? <Text style={[styles.bubbleBody, mine && styles.mineText]}>{item.body}</Text> : null}
          {item.link ? (
            <Pressable accessibilityRole="button" onPress={() => onOpenLink(item.link as InternalLink)} style={styles.linkButton}>
              <Text style={styles.linkText}>{item.link.type === 'assignment' ? t('Ver tarea') : item.link.type === 'quiz' ? t('Abrir evaluación') : item.link.type === 'course' ? t('Ver curso') : t('Abrir lección')}</Text>
            </Pressable>
          ) : null}
          <Text style={[styles.meta, mine && styles.mineMeta]}>
            {item.state === 'pending' ? t('Pendiente · se enviará al tener conexión') : item.state === 'failed' ? `${t('No se envió')}${item.error ? `: ${item.error}` : ''}` : formatWhen(item.created_at)}
          </Text>
          {item.state === 'failed' && item.client_event_id ? (
            <Pressable hitSlop={12} accessibilityRole="button" onPress={() => void dismissOutboxEvent(item.client_event_id as string).then(load)}>
              <Text style={styles.discard}>{t('Descartar')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View collapsable={false} ref={frame} style={[styles.flex, { paddingBottom: inset }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Volver')} onPress={onBack} hitSlop={12}><Ionicons name="arrow-back" size={22} color={colors.primary} /></Pressable>
        <Text style={styles.heading}>{heading}</Text>
      </View>
      {fromCache && syncedAt ? <Text style={styles.sync}>{t('Sin conexión · actualizado el {date}', { date: new Date(syncedAt).toLocaleString(locale()) })}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={styles.flex} color={colors.primary} /> : (
        <FlatList
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="never"
          inverted
          data={list}
          keyExtractor={(item, index) => (item.client_event_id ? `e-${item.client_event_id}` : `m-${item.id}-${index}`)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={styles.empty}>{thread?.type === 'system' ? t('Sin avisos todavía.') : t('Escribe el primer mensaje.')}</Text>}
        />
      )}
      {canReply ? (
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel={t('Escribe un mensaje')}
            multiline
            maxLength={4000}
            onChangeText={setText}
            placeholder={network.offline ? t('Sin conexión: se enviará al volver') : t('Escribe un mensaje')}
            placeholderTextColor={colors.textMuted}
            testID="thread-input"
            style={styles.input}
            value={text}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={t('Enviar')} disabled={!text.trim()} onPress={() => void send()} style={[styles.send, !text.trim() && styles.sendDisabled]}>
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  heading: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '900' },
  sync: { color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  error: { color: colors.danger, padding: spacing.md },
  list: { gap: spacing.sm, padding: spacing.md },
  empty: { color: colors.textMuted, padding: spacing.lg, textAlign: 'center' },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { borderRadius: radius.lg, gap: 4, maxWidth: '85%', padding: spacing.sm },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  bubbleNotice: { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderWidth: 1, maxWidth: '100%' },
  bubbleTitle: { color: colors.text, fontWeight: '900' },
  bubbleBody: { color: colors.text, fontSize: 15, lineHeight: 21 },
  mineText: { color: colors.white },
  meta: { color: colors.textMuted, fontSize: 11 },
  mineMeta: { color: '#DCE6FF' },
  discard: { color: colors.white, fontWeight: '800', textDecorationLine: 'underline' },
  linkButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: colors.white, borderColor: colors.primary, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  linkText: { color: colors.primary, fontWeight: '800' },
  composer: { alignItems: 'flex-end', backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  input: { backgroundColor: colors.background, borderRadius: radius.md, color: colors.text, flex: 1, fontSize: 15, maxHeight: 120, minHeight: 42, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  send: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  sendDisabled: { opacity: 0.4 },
});
