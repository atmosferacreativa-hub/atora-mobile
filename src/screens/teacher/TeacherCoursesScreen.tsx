import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchTeacherCourses } from '../../api/teacher';
import { colors, radius, spacing } from '../../theme';
import type { TeacherCourse } from '../../teacher/types';
import { t } from '../../i18n';

type Props = { token: string; onOpenCourse: (course: TeacherCourse) => void };

/** Cursos y secciones del docente (0.7.0), con estudiantes y entregas pendientes. */
export function TeacherCoursesScreen({ token, onOpenCourse }: Props) {
  const [items, setItems] = useState<TeacherCourse[] | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTeacherCourses(token);
      setItems(result.data.items);
      setFromCache(result.fromCache);
      setError('');
    } catch {
      setError(t('No pudimos cargar tus cursos. Conéctate para sincronizar.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Text style={styles.eyebrow}>{t('MIS CURSOS')}</Text>
      {fromCache ? <Text style={styles.sync}>{t('Sin conexión · lo último sincronizado')}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!items && !error ? <ActivityIndicator color={colors.primary} /> : null}
      {items && !items.length ? <Text style={styles.empty}>{t('Todavía no tienes cursos asignados.')}</Text> : null}
      {(items ?? []).map((course) => (
        <Pressable key={course.id} accessibilityRole="button" onPress={() => onOpenCourse(course)} style={styles.card}>
          <View style={styles.cardText}>
            <Text style={styles.title}>{course.title}</Text>
            <Text style={styles.meta}>
              {course.students === 1 ? t('1 estudiante') : t('{count} estudiantes', { count: course.students })}
              {course.pending_submissions ? ` · ${t('{count} por calificar', { count: course.pending_submissions })}` : ''}
            </Text>
            {course.sections.length ? <Text style={styles.meta}>{course.sections.map((section) => section.title).join(' · ')}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  sync: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.danger },
  empty: { color: colors.textMuted },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  cardText: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 17, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 13 },
});
