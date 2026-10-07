import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchTeacherToday } from '../../api/teacher';
import { RiskBadge } from '../../components/RiskBadge';
import { colors, radius, spacing } from '../../theme';
import type { TeacherToday } from '../../teacher/types';
import { locale, t } from '../../i18n';

type Props = {
  token: string;
  name: string;
  onOpenGrading: () => void;
  onOpenStudent: (studentId: number, courseId: number, name: string) => void;
  onOpenMessages: () => void;
};

/** Hoy del docente (0.7.0): por calificar, estudiantes en riesgo, clases y fechas del día, mensajes. */
export function TeacherTodayScreen({ token, name, onOpenGrading, onOpenStudent, onOpenMessages }: Props) {
  const [data, setData] = useState<TeacherToday | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTeacherToday(token);
      setData(result.data);
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

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Text style={styles.eyebrow}>{t('MI DÍA DOCENTE')}</Text>
      <Text style={styles.title}>{t('Hola, {name}', { name: name || t('Docente') })}</Text>
      {fromCache && syncedAt ? <Text style={styles.sync}>{t('Sin conexión · actualizado el {date}', { date: new Date(syncedAt).toLocaleString(locale()) })}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!data && !error ? <ActivityIndicator color={colors.primary} /> : null}

      {data ? (
        <Pressable accessibilityRole="button" onPress={onOpenGrading} style={styles.hero} testID="teacher-to-grade">
          <Text style={styles.heroEyebrow}>{t('POR CALIFICAR')}</Text>
          <Text style={styles.heroTitle}>{data.to_grade.count === 1 ? t('1 entrega') : t('{count} entregas', { count: data.to_grade.count })}</Text>
          {data.to_grade.oldest.map((item) => (
            <Text key={item.id} style={styles.heroMeta} numberOfLines={1}>
              {item.student.name} · {item.lesson.title}{item.is_late ? ` · ${t('Tardía')}` : ''}
            </Text>
          ))}
        </Pressable>
      ) : null}

      {data ? (
        <View style={styles.section}>
          <Text style={styles.heading}>{t('Estudiantes en riesgo')}</Text>
          {data.at_risk.items.length ? data.at_risk.items.map((item) => (
            <Pressable
              key={`${item.course.id}-${item.student.id}`}
              accessibilityRole="button"
              onPress={() => onOpenStudent(item.student.id, item.course.id, item.student.name)}
              style={styles.row}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.student.name}</Text>
                <Text style={styles.rowMeta}>{item.course.title}</Text>
                <RiskBadge risk={item.risk} />
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          )) : <Text style={styles.empty}>{t('Nadie en riesgo por ahora.')}</Text>}
        </View>
      ) : null}

      {data ? (
        <View style={styles.section}>
          <Text style={styles.heading}>{t('Hoy en tus cursos')}</Text>
          {data.today.length ? data.today.map((item, index) => (
            <View key={`t-${index}`} style={styles.row}>
              <Ionicons name={item.type === 'live_class' ? 'videocam-outline' : item.type === 'event' ? 'calendar-outline' : 'time-outline'} size={20} color={colors.primary} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {item.type === 'assignment_due' || item.type === 'quiz_due' ? `${t('Vence')} ` : ''}
                  {new Date(item.starts_at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
                  {item.course ? ` · ${item.course.title}` : ''}
                </Text>
              </View>
            </View>
          )) : <Text style={styles.empty}>{t('Sin clases ni fechas límite hoy.')}</Text>}
        </View>
      ) : null}

      {data && data.unread_messages > 0 ? (
        <Pressable accessibilityRole="button" onPress={onOpenMessages} style={styles.row}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
          <Text style={[styles.rowTitle, styles.rowText]}>{data.unread_messages === 1 ? t('Tienes 1 mensaje sin leer') : t('Tienes {count} mensajes sin leer', { count: data.unread_messages })}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
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
  hero: { backgroundColor: colors.primaryStrong, borderRadius: radius.lg, gap: 4, padding: spacing.lg },
  heroEyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.white, fontSize: 22, fontWeight: '900' },
  heroMeta: { color: '#DCE6FF', fontSize: 13 },
  section: { gap: spacing.xs },
  heading: { color: colors.primaryStrong, fontSize: 17, fontWeight: '900' },
  empty: { color: colors.textMuted },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { color: colors.text, fontWeight: '800' },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
});
