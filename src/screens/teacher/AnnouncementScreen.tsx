import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { flushOutbox, subscribeOutbox } from '../../offline/outbox/runtime';
import { pendingAnnouncements, sendAnnouncement } from '../../api/teacher';
import { pendingFor } from '../../teacher/announcements';
import { useNetworkState } from '../../hooks/useNetworkState';
import { colors, radius, spacing } from '../../theme';
import { t } from '../../i18n';

type Props = { token: string; courseId: number; title: string; sections: { id: number; title: string }[]; onBack: () => void };
type Pending = Awaited<ReturnType<typeof pendingAnnouncements>>[number];

/** Aviso al grupo (0.7.0): llega a "Avisos" de cada estudiante. Sin conexión queda en la cola y sale al volver. */
export function AnnouncementScreen({ token, courseId, title, sections, onBack }: Props) {
  const { offline } = useNetworkState();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [section, setSection] = useState<number | undefined>(undefined);
  const [pending, setPending] = useState<Pending[]>([]);
  const [notice, setNotice] = useState('');

  const refreshPending = useCallback(() => {
    void pendingAnnouncements().then((events) => setPending(pendingFor(events, courseId))).catch(() => undefined);
  }, [courseId]);

  useEffect(() => {
    refreshPending();
    return subscribeOutbox(refreshPending);
  }, [refreshPending]);

  const send = async () => {
    const id = await sendAnnouncement(courseId, subject, body, section);
    if (!id) {
      setNotice(t('Escribe el aviso antes de enviarlo.'));
      return;
    }
    setSubject('');
    setBody('');
    setNotice(offline ? t('Guardado. Se enviará cuando tengas conexión.') : t('Enviando…'));
    refreshPending();
    if (!offline) void flushOutbox(token).finally(refreshPending);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Volver')} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryStrong} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{t('AVISO AL GRUPO')}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
        </View>
      </View>
      {sections.length > 1 ? (
        <View style={styles.chips}>
          <Pressable accessibilityRole="button" onPress={() => setSection(undefined)} style={[styles.chip, section === undefined && styles.chipOn]}>
            <Text style={[styles.chipText, section === undefined && styles.chipTextOn]}>{t('Todo el curso')}</Text>
          </Pressable>
          {sections.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" onPress={() => setSection(item.id)} style={[styles.chip, section === item.id && styles.chipOn]}>
              <Text style={[styles.chipText, section === item.id && styles.chipTextOn]}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput accessibilityLabel={t('Asunto')} onChangeText={setSubject} placeholder={t('Asunto (opcional)')} style={styles.input} testID="announcement-title" value={subject} maxLength={120} />
      <TextInput accessibilityLabel={t('Aviso')} multiline onChangeText={setBody} placeholder={t('Escribe el aviso para tus estudiantes')} style={[styles.input, styles.body]} testID="announcement-body" value={body} />
      <Pressable accessibilityRole="button" onPress={() => void send()} style={styles.send} testID="announcement-send">
        <Ionicons name="send" size={18} color={colors.white} />
        <Text style={styles.sendText}>{t('Enviar aviso')}</Text>
      </Pressable>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {pending.map((event) => (
        <View key={event.id} style={styles.pending}>
          <Text style={styles.pendingTitle}>{event.payload.title || t('Aviso')}</Text>
          <Text style={styles.pendingMeta}>{event.status === 'failed' ? `${t('No se envió')}: ${event.lastError}` : t('Pendiente · se enviará al tener conexión')}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderColor: colors.line, borderRadius: 16, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextOn: { color: colors.white },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, fontSize: 16, padding: spacing.md },
  body: { minHeight: 140, textAlignVertical: 'top' },
  send: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', padding: spacing.md },
  sendText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  notice: { color: colors.textMuted },
  pending: { backgroundColor: colors.accentSoft, borderRadius: radius.md, gap: 2, padding: spacing.md },
  pendingTitle: { color: colors.text, fontWeight: '800' },
  pendingMeta: { color: colors.accentText, fontSize: 12 },
});
