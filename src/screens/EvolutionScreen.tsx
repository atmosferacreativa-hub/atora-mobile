import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCourseGrades, fetchGrades, markGradesSeen } from '../api/grades';
import { colors, spacing } from '../theme';
import type { ActivityGrade, AcademicStatus, CourseGrade, GradesSummary } from '../types';

type Props = {
  token: string;
  newGradeCourses: number[];
  onBack: () => void;
  onOpenCourseGrades: (courseId: number, title: string) => void;
  onSeen: () => void;
};

export const STATUS_LABELS: Record<AcademicStatus, string> = {
  not_started: 'Sin empezar',
  in_progress: 'En curso',
  at_risk: 'En riesgo',
  approved: 'Aprobado',
  not_approved: 'No aprobado',
};

/** Tipos de actividad que cuentan como evaluación (los del plugin). */
const EVALUATION_TYPES = ['tarea', 'quiz', 'evaluacion'];

const formatSync = (ms: number) => new Date(ms).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Bar({ value }: { value: number }) {
  return (
    <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>
  );
}

/** Evolución (0.5.0): avance por programa y curso, nota acumulada y próximas evaluaciones. */
export function EvolutionScreen({ token, newGradeCourses, onBack, onOpenCourseGrades, onSeen }: Props) {
  const [summary, setSummary] = useState<GradesSummary | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [upcoming, setUpcoming] = useState<(ActivityGrade & { courseTitle: string })[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchGrades(token);
      setSummary(result.data);
      setSyncedAt(result.syncedAt);
      setFromCache(result.fromCache);
      // Próximas evaluaciones: tareas y quizzes pendientes de cada curso (también desde la caché).
      const details = await Promise.all(result.data.courses.map((course) => fetchCourseGrades(course.course_id, token).then((d) => ({ course, d })).catch(() => null)));
      setUpcoming(details.flatMap((entry) => (entry ? entry.d.data.activities
        .filter((a) => a.status === 'pending' && EVALUATION_TYPES.includes(a.activity_type))
        .map((a) => ({ ...a, courseTitle: entry.course.title })) : [])).slice(0, 6));
      if (!result.fromCache) {
        await markGradesSeen(result.data);
        onSeen();
      }
    } catch {
      setError('No pudimos cargar tu evolución. Conéctate para sincronizar por primera vez.');
    } finally {
      setLoading(false);
    }
  }, [token, onSeen]);

  useEffect(() => { void load(); }, [load]);

  if (!summary && !error) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>← Volver</Text></Pressable>
      <Text style={styles.title}>Mi evolución</Text>
      {syncedAt ? (
        <Text style={styles.sync}>{fromCache ? 'Sin conexión · ' : ''}Actualizado el {formatSync(syncedAt)}</Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      {summary?.programs.length ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Programas</Text>
          {summary.programs.map((program) => (
            <View key={program.wp_program_id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{program.title}</Text>
                <Text style={styles.grade}>{program.final_grade ?? '—'}</Text>
              </View>
              <Bar value={program.progress} />
              <Text style={styles.meta}>{program.progress}% de avance · {program.courses} curso(s)</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.heading}>Cursos</Text>
        {summary?.courses.map((course: CourseGrade) => (
          <Pressable key={course.course_id} accessibilityRole="button" onPress={() => onOpenCourseGrades(course.course_id, course.title)} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{course.title}</Text>
              {newGradeCourses.includes(course.course_id) ? <Text style={styles.newBadge}>Nota nueva</Text> : null}
              <Text style={styles.grade}>{course.final_grade ?? '—'}</Text>
            </View>
            <Bar value={course.progress} />
            <Text style={styles.meta}>{course.progress}% de avance · {STATUS_LABELS[course.status] ?? course.status} · aprueba con {course.passing_grade}</Text>
          </Pressable>
        ))}
        {summary && !summary.courses.length ? <Text style={styles.meta}>Todavía no tienes cursos con notas.</Text> : null}
      </View>

      {upcoming.length ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Próximas evaluaciones</Text>
          {upcoming.map((item) => (
            <View key={`${item.courseTitle}-${item.lesson_id}`} style={styles.upcoming}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.meta}>{item.courseTitle}{item.weight_label ? ` · ${item.weight_label}` : ''}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.md, padding: spacing.lg },
  back: { color: colors.blue, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 28, fontWeight: '900' },
  sync: { color: colors.muted, fontSize: 12 },
  error: { color: colors.red },
  section: { gap: spacing.sm },
  heading: { color: colors.navy, fontSize: 18, fontWeight: '900' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  cardTitle: { color: colors.ink, flex: 1, fontWeight: '800' },
  grade: { color: colors.navy, fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900' },
  newBadge: { backgroundColor: colors.mustard, borderRadius: 10, color: colors.navy, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  track: { backgroundColor: colors.border, borderRadius: 4, height: 6, overflow: 'hidden' },
  fill: { backgroundColor: colors.blue, height: 6 },
  meta: { color: colors.muted, fontSize: 12 },
  upcoming: { borderLeftColor: colors.mustard, borderLeftWidth: 3, gap: 2, paddingLeft: spacing.sm },
});
