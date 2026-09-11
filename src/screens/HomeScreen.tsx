import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import type { StudentHome } from '../types';

type Props = {
  data: StudentHome | null;
  loading: boolean;
  onRefresh: () => void;
};

export function HomeScreen({ data, loading, onRefresh }: Props) {
  if (!data && loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.blue} size="large" /></View>;
  }

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

      <Text style={styles.heading}>Cursos en progreso</Text>
      {!data?.courses.length ? (
        <Text style={styles.empty}>Todavía no tienes cursos activos.</Text>
      ) : data.courses.map((course) => (
        <View key={course.id} style={styles.card}>
          <Text style={styles.cardTitle}>{course.title}</Text>
          <Text style={styles.next}>
            {course.completed_lessons} de {course.total_lessons} lecciones
          </Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.min(100, course.progress)}%` }]} />
          </View>
          <Text style={styles.progress}>{course.progress}% completado</Text>
        </View>
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
  heading: { color: colors.navy, fontSize: 20, fontWeight: '800', marginTop: spacing.sm },
  empty: { color: colors.muted, fontSize: 15 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  next: { color: colors.muted },
  track: { backgroundColor: colors.border, borderRadius: 4, height: 8, overflow: 'hidden' },
  bar: { backgroundColor: colors.blue, height: 8 },
  progress: { color: colors.blue, fontSize: 12, fontWeight: '700' },
});
