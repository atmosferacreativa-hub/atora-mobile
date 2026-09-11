import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import type { StudentHome } from '../types';

const preview: StudentHome = {
  displayName: 'Estudiante',
  pendingActivities: 3,
  courses: [
    { id: 1, title: 'Liderazgo', progress: 68, nextLesson: 'Comunicación efectiva' },
    { id: 2, title: 'Seguridad y Salud en el Trabajo', progress: 34, nextLesson: 'Prevención' },
  ],
};

export function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>MI JORNADA</Text>
      <Text style={styles.title}>Hola, {preview.displayName}</Text>
      <Text style={styles.subtitle}>Continúa aprendiendo donde lo dejaste.</Text>

      <View style={styles.pending}>
        <Text style={styles.pendingNumber}>{preview.pendingActivities}</Text>
        <Text style={styles.pendingText}>actividades pendientes</Text>
      </View>

      <Text style={styles.heading}>Cursos en progreso</Text>
      {preview.courses.map((course) => (
        <View key={course.id} style={styles.card}>
          <Text style={styles.cardTitle}>{course.title}</Text>
          <Text style={styles.next}>Siguiente: {course.nextLesson}</Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${course.progress}%` }]} />
          </View>
          <Text style={styles.progress}>{course.progress}% completado</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  eyebrow: { color: colors.mustard, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.navy, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16 },
  pending: { backgroundColor: colors.navy, borderRadius: 18, padding: spacing.lg },
  pendingNumber: { color: colors.mustard, fontSize: 36, fontWeight: '800' },
  pendingText: { color: colors.white, fontSize: 16 },
  heading: { color: colors.navy, fontSize: 20, fontWeight: '800', marginTop: spacing.sm },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  next: { color: colors.muted },
  track: { backgroundColor: colors.border, borderRadius: 4, height: 8, overflow: 'hidden' },
  bar: { backgroundColor: colors.blue, height: 8 },
  progress: { color: colors.blue, fontSize: 12, fontWeight: '700' },
});
