import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchToday } from '../api/today';
import { PendingQuizNotice } from '../components/PendingQuizNotice';
import { usePendingQuizzes } from '../hooks/usePendingQuizzes';
import { colors, radius, spacing } from '../theme';
import type { AgendaItem, InternalLink, TodayStudent } from '../types';
import { locale, t } from '../i18n';

type Props = {
  token: string;
  name: string;
  newGradeCourses: number[];
  onOpenLesson: (lessonId: number) => void;
  onOpenQuiz: (lessonId: number) => void;
  onOpenLink: (link: InternalLink) => void;
  onOpenMessages: () => void;
  onOpenCourseGrades: (courseId: number, title: string) => void;
};

function Deadline({ item, late, onOpen }: { item: AgendaItem; late?: boolean; onOpen: () => void }) {
  const when = new Date(item.starts_at);
  return (
    <Pressable accessibilityRole="button" disabled={!item.link} onPress={onOpen} style={[styles.row, late && styles.rowLate]}>
      <Ionicons name={item.type === 'quiz_due' ? 'help-circle-outline' : 'document-text-outline'} size={20} color={late ? colors.danger : colors.primary} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={[styles.rowMeta, late && styles.lateText]}>
          {t(late ? 'Venció el {date}' : 'Vence el {date}', { date: `${when.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })} ${when.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}` })}
          {item.course ? ` · ${item.course.title}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

/** Hoy del estudiante (0.6.0): bloques de /today; sin conexión, lo último sincronizado. */
export function TodayScreen({ token, name, newGradeCourses, onOpenLesson, onOpenQuiz, onOpenLink, onOpenMessages, onOpenCourseGrades }: Props) {
  const pendingQuizzes = usePendingQuizzes();
  const [data, setData] = useState<TodayStudent | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchToday(token, 'student');
      setData(result.data as TodayStudent);
      setSyncedAt(result.syncedAt);
      setFromCache(result.fromCache);
      setError('');
    } catch {
      setError(t('No pudimos cargar tu día. Conéctate para sincronizar.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const grades = (data?.new_grades ?? []).filter((grade) => newGradeCourses.includes(grade.course_id));

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Text style={styles.eyebrow}>{t('MI JORNADA')}</Text>
      <Text style={styles.title}>{t('Hola, {name}', { name: name || t('Estudiante') })}</Text>
      {fromCache && syncedAt ? <Text style={styles.sync}>{t('Sin conexión · actualizado el {date}', { date: new Date(syncedAt).toLocaleString(locale()) })}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      {pendingQuizzes.map((item) => <PendingQuizNotice key={item.lessonId} item={item} onOpen={() => onOpenQuiz(item.lessonId)} />)}

      {!data && !error ? <ActivityIndicator color={colors.primary} /> : null}

      {data?.continue ? (
        <Pressable accessibilityRole="button" onPress={() => onOpenLesson(data.continue!.lesson.id)} style={styles.continue}>
          <Text style={styles.continueEyebrow}>{t('CONTINUAR')}</Text>
          <Text style={styles.continueTitle}>{data.continue.lesson.title}</Text>
          <Text style={styles.continueMeta}>{data.continue.course.title} · {t('{percent}% del curso', { percent: data.continue.progress })}</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, data.continue.progress))}%` }]} /></View>
        </Pressable>
      ) : null}

      {data?.overdue.length ? (
        <View style={styles.section}>
          <Text style={styles.heading}>{t('Vencidas sin entregar')}</Text>
          {data.overdue.map((item, index) => <Deadline key={`o-${index}`} item={item} late onOpen={() => item.link && onOpenLink(item.link)} />)}
        </View>
      ) : null}

      {data ? (
        <View style={styles.section}>
          <Text style={styles.heading}>{t('Próximos 7 días')}</Text>
          {data.upcoming.length
            ? data.upcoming.map((item, index) => <Deadline key={`u-${index}`} item={item} onOpen={() => item.link && onOpenLink(item.link)} />)
            : <Text style={styles.empty}>{t('Nada por entregar esta semana.')}</Text>}
        </View>
      ) : null}

      {data && data.unread_messages > 0 ? (
        <Pressable accessibilityRole="button" onPress={onOpenMessages} style={styles.row}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
          <Text style={[styles.rowTitle, styles.rowText]}>{data.unread_messages === 1 ? t('Tienes 1 mensaje sin leer') : t('Tienes {count} mensajes sin leer', { count: data.unread_messages })}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {grades.length ? (
        <View style={styles.section}>
          <Text style={styles.heading}>{t('Notas nuevas')}</Text>
          {grades.map((grade) => (
            <Pressable key={grade.course_id} accessibilityRole="button" onPress={() => onOpenCourseGrades(grade.course_id, grade.title)} style={styles.row}>
              <Ionicons name="ribbon-outline" size={20} color={colors.accentText} />
              <Text style={[styles.rowTitle, styles.rowText]}>{grade.title}</Text>
              <Text style={styles.newBadge}>{t('Nota nueva')}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  sync: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.danger },
  continue: { backgroundColor: colors.primaryStrong, borderRadius: radius.lg, gap: 4, padding: spacing.lg },
  continueEyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  continueTitle: { color: colors.white, fontSize: 20, fontWeight: '900' },
  continueMeta: { color: '#DCE6FF', fontSize: 13 },
  track: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, height: 6, marginTop: spacing.xs, overflow: 'hidden' },
  fill: { backgroundColor: colors.accent, height: 6 },
  section: { gap: spacing.xs },
  heading: { color: colors.primaryStrong, fontSize: 17, fontWeight: '900' },
  empty: { color: colors.textMuted },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  rowLate: { borderColor: colors.danger },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontWeight: '800' },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  lateText: { color: colors.danger },
  newBadge: { backgroundColor: colors.accent, borderRadius: 10, color: colors.text, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
});
