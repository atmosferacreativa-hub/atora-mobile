import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import type { CourseSummary } from '../types';

type Props = { courses: CourseSummary[]; onOpen: (courseId: number) => void };

export function CoursesScreen({ courses, onOpen }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mis cursos</Text>
      <Text style={styles.subtitle}>Contenido nativo disponible desde tu academia.</Text>
      {courses.map((course) => (
        <Pressable key={course.id} onPress={() => onOpen(course.id)} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{course.title}</Text>
            <Text style={styles.percent}>{course.progress}%</Text>
          </View>
          <Text numberOfLines={2} style={styles.excerpt}>{course.excerpt || 'Continúa tu recorrido formativo.'}</Text>
          <View style={styles.track}><View style={[styles.bar, { width: `${course.progress}%` }]} /></View>
          <Text style={styles.open}>Abrir curso →</Text>
        </Pressable>
      ))}
      {!courses.length ? <Text style={styles.empty}>No hay cursos activos.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  title: { color: colors.navy, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: '800' },
  percent: { color: colors.blue, fontWeight: '800' },
  excerpt: { color: colors.muted, lineHeight: 20 },
  track: { backgroundColor: colors.border, borderRadius: 4, height: 7, overflow: 'hidden' },
  bar: { backgroundColor: colors.mustard, height: 7 },
  open: { color: colors.blue, fontWeight: '800' },
  empty: { color: colors.muted, textAlign: 'center' },
});
