import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCourse } from '../api/courses';
import { fetchPrograms } from '../api/programs';
import { colors, spacing } from '../theme';
import type { StudentHome } from '../types';
import { resolveMediaUrl } from '../utils/mediaUrl';

type Props = {
  data: StudentHome | null;
  loading: boolean;
  onRefresh: () => void;
  token: string;
  onOpenCourse: (courseId: number) => void;
  onOpenLesson: (lessonId: number) => void;
  onOpenProgram: (programId: number) => void;
};

export function HomeScreen({ data, loading, onRefresh, token, onOpenCourse, onOpenLesson, onOpenProgram }: Props) {
  if (!data && loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.blue} size="large" /></View>;
  }

  const [programId, setProgramId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchPrograms(token)
      .then((items) => {
        if (!active) return;
        setProgramId(items[0]?.id ?? null);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [token]);

  const continueCourse = async (courseId: number) => {
    try {
      const detail = await fetchCourse(courseId, token);
      const next = detail.curriculum.find((item) => !item.completed) ?? detail.curriculum[0];
      if (next) return onOpenLesson(next.id);
    } catch {
      // fallback to course screen
    }
    onOpenCourse(courseId);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
    >
      <Text style={styles.eyebrow}>MI JORNADA</Text>
      <Text style={styles.title}>Hola, {data?.user.display_name || 'Estudiante'}</Text>
      <Text style={styles.subtitle}>Continúa aprendiendo donde lo dejaste.</Text>

      <View style={styles.pending}>
        <Text style={styles.pendingNumber}>{data?.pending_activities ?? 0}</Text>
        <Text style={styles.pendingText}>actividades pendientes</Text>
      </View>

      {programId ? (
        <View style={styles.programCard}>
          <View style={styles.programCopy}>
            <Text style={styles.programEyebrow}>PROGRAMA DE PRUEBA</Text>
            <Text style={styles.programTitle}>Diplomado en Comunicación</Text>
            <Text style={styles.programHelp}>Accede al programa completo desde el panel web mientras terminamos la vista nativa.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpenProgram(programId)}
            style={styles.programButton}
          >
            <Text style={styles.programButtonText}>Abrir programa</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.heading}>Cursos en progreso</Text>
      {!data?.courses.length ? (
        <Text style={styles.empty}>Todavía no tienes cursos activos.</Text>
      ) : data.courses.map((course) => (
        <Pressable key={course.id} onPress={() => void continueCourse(course.id)} style={styles.card}>
          {course.thumbnail_url ? <Image source={{ uri: resolveMediaUrl(course.thumbnail_url) }} style={styles.thumb} /> : null}
          <Text style={styles.cardTitle}>{course.title}</Text>
          <Text style={styles.next}>{course.completed_lessons} de {course.total_lessons} lecciones</Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.min(100, course.progress)}%` }]} />
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.progress}>{course.progress}% completado</Text>
            <Text style={styles.cta}>{course.progress > 0 ? 'Continuar →' : 'Empezar →'}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md },
  eyebrow: { color: colors.mustard, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.navy, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16 },
  pending: { backgroundColor: colors.navy, borderRadius: 18, padding: spacing.lg },
  pendingNumber: { color: colors.mustard, fontSize: 36, fontWeight: '800' },
  pendingText: { color: colors.white, fontSize: 16 },
  programCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  programCopy: { gap: spacing.xs },
  programEyebrow: { color: colors.mustard, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  programTitle: { color: colors.navy, fontSize: 22, fontWeight: '900' },
  programHelp: { color: colors.muted, lineHeight: 20 },
  programButton: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 14, justifyContent: 'center', minHeight: 52, padding: spacing.md },
  programButtonText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  heading: { color: colors.navy, fontSize: 20, fontWeight: '800', marginTop: spacing.sm },
  empty: { color: colors.muted, fontSize: 15 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  thumb: { backgroundColor: colors.border, borderRadius: 12, height: 140, width: '100%' },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  next: { color: colors.muted },
  track: { backgroundColor: colors.border, borderRadius: 4, height: 8, overflow: 'hidden' },
  bar: { backgroundColor: colors.blue, height: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  progress: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  cta: { color: colors.navy, fontSize: 12, fontWeight: '900' },
});
