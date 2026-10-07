import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCourseGrades, fetchGrades, markGradesSeen } from '../api/grades';
import { gradeLabel } from '../grades/gradeLabel';
import { colors, spacing } from '../theme';
import type { ActivityGrade, CourseGradesDetail } from '../types';
import { STATUS_LABELS } from './EvolutionScreen';
import { locale, t, tk } from '../i18n';

type Props = {
  courseId: number;
  title: string;
  token: string;
  onBack: () => void;
  onOpenAssignment: (lessonId: number) => void;
  onOpenLesson: (lessonId: number) => void;
  onSeen: () => void;
};

const ACTIVITY_STATUS: Record<ActivityGrade['status'], string> = {
  graded: tk('Calificada'),
  in_review: tk('En revisión'),
  needs_revision: tk('Devuelta para corregir'),
  completed: tk('Completada'),
  pending: tk('Pendiente'),
};

/** Notas de un curso (0.5.0): cada actividad con su nota (solo liberadas) y estado. */
export function CourseGradesScreen({ courseId, title, token, onBack, onOpenAssignment, onOpenLesson, onSeen }: Props) {
  const [detail, setDetail] = useState<CourseGradesDetail | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchCourseGrades(courseId, token);
      setDetail(result.data);
      setSyncedAt(result.syncedAt);
      setFromCache(result.fromCache);
      if (!result.fromCache) {
        const summary = await fetchGrades(token).catch(() => null);
        if (summary) await markGradesSeen(summary.data, [courseId]);
        onSeen();
      }
    } catch {
      setError(t('No pudimos cargar las notas. Conéctate para sincronizarlas.'));
    } finally {
      setLoading(false);
    }
  }, [courseId, token, onSeen]);

  useEffect(() => { void load(); }, [load]);

  if (!detail && !error) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>{t('← Volver')}</Text></Pressable>
      <Text style={styles.title}>{t('Notas')} · {title}</Text>
      {syncedAt ? <Text style={styles.sync}>{fromCache ? `${t('Sin conexión')} · ` : ''}{t('Actualizado el {date}', { date: new Date(syncedAt).toLocaleString(locale()) })}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {detail ? (
        <View style={styles.summary}>
          <Text style={gradeLabel(detail.course.final_grade).empty ? styles.summaryEmpty : styles.summaryGrade}>{gradeLabel(detail.course.final_grade).text}</Text>
          <Text style={styles.meta}>{t('Nota acumulada')} · {STATUS_LABELS[detail.course.status] ? t(STATUS_LABELS[detail.course.status]) : detail.course.status} · {t('{percent}% de avance', { percent: detail.course.progress })}</Text>
        </View>
      ) : null}
      {detail?.activities.map((activity) => {
        const open = activity.kind === 'assignment' || activity.activity_type === 'tarea'
          ? () => onOpenAssignment(activity.lesson_id)
          : () => onOpenLesson(activity.lesson_id);
        return (
          <Pressable key={activity.lesson_id} accessibilityRole="button" onPress={open} style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.name}>{activity.title}</Text>
              <Text style={[styles.status, activity.status === 'graded' && styles.statusOk, activity.status === 'needs_revision' && styles.statusWarn]}>
                {ACTIVITY_STATUS[activity.status] ? t(ACTIVITY_STATUS[activity.status]) : activity.status}{activity.weight_label ? ` · ${activity.weight_label}${activity.weight !== null ? ` (${activity.weight}%)` : ''}` : ''}
                {activity.has_feedback ? ` · ${t('con comentarios')}` : ''}
              </Text>
            </View>
            <Text style={styles.grade}>{activity.grade ?? '—'}</Text>
          </Pressable>
        );
      })}
      {detail && !detail.activities.length ? <Text style={styles.meta}>{t('Este curso todavía no tiene actividades con nota.')}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.md, padding: spacing.lg },
  back: { color: colors.blue, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 24, fontWeight: '900' },
  sync: { color: colors.muted, fontSize: 12 },
  error: { color: colors.red },
  summary: { alignItems: 'center', backgroundColor: colors.navy, borderRadius: 18, gap: 4, padding: spacing.lg },
  summaryGrade: { color: colors.mustard, fontSize: 40, fontWeight: '900' },
  summaryEmpty: { color: colors.mustard, fontSize: 20, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12 },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  flex: { flex: 1, gap: 2 },
  name: { color: colors.ink, fontWeight: '800' },
  status: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  statusOk: { color: colors.success },
  statusWarn: { color: colors.accentText },
  grade: { color: colors.navy, fontSize: 20, fontVariant: ['tabular-nums'], fontWeight: '900' },
});
