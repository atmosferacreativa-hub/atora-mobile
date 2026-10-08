import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aiNoticeSeen, askAssistant, markAiNoticeSeen } from '../api/ai';
import { ApiError } from '../api/client';
import { newEventId } from '../offline/outbox/runtime';
import { aiDisclaimer, appendTurn, getConversation, historyFor, limitMessage, offlineMessage, type Turn } from '../ai/conversation';
import { useNetworkState } from '../hooks/useNetworkState';
import { colors, radius, spacing } from '../theme';
import { t } from '../i18n';
// 1.0.1: la caja de escritura queda pegada al teclado (también con borde a borde).
import { useKeyboardInset } from '../hooks/useKeyboardInset';

type Props = {
  token: string;
  lessonId: number;
  title: string;
  onBack: () => void;
};

/**
 * Asistente de la lección (0.9.0). La conversación queda solo en el teléfono
 * durante la sesión. Sin conexión no se puede preguntar (no hay cola).
 */
export function AssistantScreen({ token, lessonId, title, onBack }: Props) {
  const frame = useRef<View>(null);
  const inset = useKeyboardInset(frame);
  const { offline } = useNetworkState();
  const [turns, setTurns] = useState<Turn[]>(() => getConversation(lessonId));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Reintentar la misma pregunta usa el mismo id: el servidor no la cobra dos veces. */
  const pending = useRef<{ message: string; eventId: string } | null>(null);
  const list = useRef<FlatList<Turn>>(null);

  useEffect(() => {
    void aiNoticeSeen().then((seen) => {
      if (seen) return;
      Alert.alert(t('Asistente con IA'), aiDisclaimer(), [{ text: t('Entendido'), onPress: () => void markAiNoticeSeen() }]);
    });
  }, []);

  const send = async () => {
    const message = text.trim();
    if (!message || busy || offline) return;
    if (!pending.current || pending.current.message !== message) pending.current = { message, eventId: newEventId() };
    setBusy(true);
    setError('');
    try {
      const history = historyFor(getConversation(lessonId));
      const response = await askAssistant(token, lessonId, message, history, pending.current.eventId);
      appendTurn(lessonId, { role: 'user', content: message });
      setTurns(appendTurn(lessonId, { role: 'assistant', content: response.reply }));
      pending.current = null;
      setText('');
      requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 429) setError(limitMessage(reason.message, reason.data?.reset_at));
      else if (reason instanceof ApiError && reason.status === 0) setError(offlineMessage());
      else if (reason instanceof ApiError && reason.status === 504) setError(t('El asistente tardó demasiado. Intenta de nuevo.'));
      else setError(reason instanceof Error ? reason.message : t('El asistente no respondió. Intenta de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View collapsable={false} ref={frame} style={[styles.flex, { paddingBottom: inset }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Volver')} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryStrong} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{t('ASISTENTE')}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
        </View>
      </View>
      <Text style={styles.disclaimer} testID="assistant-disclaimer">{aiDisclaimer()}</Text>
      <FlatList
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="never"
        ref={list}
        contentContainerStyle={styles.list}
        data={turns}
        keyExtractor={(_, index) => String(index)}
        ListEmptyComponent={<Text style={styles.empty}>{t('Pregunta lo que no entendiste de esta lección. El asistente explica y da pistas, pero no resuelve evaluaciones ni tareas.')}</Text>}
        renderItem={({ item, index }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.mine : styles.theirs]} testID={item.role === 'assistant' ? `assistant-reply-${index}` : undefined}>
            <Text style={item.role === 'user' ? styles.mineText : styles.theirsText}>{item.content}</Text>
          </View>
        )}
      />
      {offline ? <Text style={styles.notice} testID="assistant-offline">{offlineMessage()}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error} testID="assistant-error">{error}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={t('Tu pregunta')}
          editable={!offline && !busy}
          multiline
          onChangeText={setText}
          placeholder={offline ? offlineMessage() : t('Escribe tu pregunta')}
          style={[styles.input, styles.flex]}
          testID="assistant-input"
          value={text}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Enviar pregunta')}
          disabled={offline || busy || !text.trim()}
          onPress={() => void send()}
          style={[styles.send, (offline || busy || !text.trim()) && styles.disabled]}
          testID="assistant-send"
        >
          {busy ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={20} color={colors.white} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.sm },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  disclaimer: { backgroundColor: colors.accentSoft, color: colors.accentText, fontSize: 13, marginHorizontal: spacing.lg, padding: spacing.sm, borderRadius: radius.md },
  list: { gap: spacing.sm, padding: spacing.lg },
  empty: { color: colors.textMuted, textAlign: 'center' },
  bubble: { borderRadius: radius.lg, maxWidth: '88%', padding: spacing.md },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  mineText: { color: colors.white, fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  notice: { backgroundColor: colors.accentSoft, color: colors.accentText, marginHorizontal: spacing.lg, padding: spacing.sm, borderRadius: radius.md },
  error: { color: colors.danger, marginHorizontal: spacing.lg },
  composer: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 15, maxHeight: 120, padding: spacing.sm },
  send: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, height: 46, justifyContent: 'center', width: 52 },
  disabled: { opacity: 0.5 },
});
