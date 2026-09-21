import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCourse } from '../api/courses';
import { colors, spacing } from '../theme';
import type { CourseSummary } from '../types';
import { resolveMediaUrl } from '../utils/mediaUrl';

type Props = {
  courses: CourseSummary[];
  token: string;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenCourse: (courseId: number) => void;
  onOpenLesson: (lessonId: number) => void;
};

export function CoursesScreen({ courses, token, onOpenCourse, onOpenLesson, onRefresh, refreshing }: Props) {
  const [continuingId, setContinuingId] = useState<number | null>(null);

  const continueCourse = async (courseId: number) => {
    setContinuingId(courseId);
    try {
      const detail = await fetchCourse(courseId, token);
      const next = detail.curriculum.find((item) => !item.completed) ?? detail.curriculum[0];
      if (next) {
        onOpenLesson(next.id);
      } else {
        onOpenCourse(courseId);
      }
    } catch {
      onOpenCourse(courseId);
    } finally {
      setContinuingId(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Mis cursos</Text>
      <Text style={styles.subtitle}>Contenido nativo disponible desde tu academia.</Text>
      {courses.map((course) => (
        <Pressable key={course.id} onPress={() => onOpenCourse(course.id)} style={styles.card}>
          {course.thumbnail_url ? (
            <Image source={{ uri: resolveMediaUrl(course.thumbnail_url) }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.thumbPlaceholderText}>ATORA</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{course.title}</Text>
            <Text style={styles.percent}>{course.progress}%</Text>
          </View>
          <Text numberOfLines={2} style={styles.excerpt}>{course.excerpt || 'Continúa tu recorrido formativo.'}</Text>
          <View style={styles.track}><View style={[styles.bar, { width: `${course.progress}%` }]} /></View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void continueCourse(course.id)}
              style={styles.primary}
            >
              {continuingId === course.id ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryText}>{course.progress > 0 ? 'Continuar' : 'Empezar'}</Text>
              )}
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onOpenCourse(course.id)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Ver temario</Text>
            </Pressable>
          </View>
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
  thumb: { backgroundColor: colors.border, borderRadius: 12, height: 140, width: '100%' },
  thumbPlaceholder: { alignItems: 'center', backgroundColor: colors.navy, borderRadius: 12, height: 140, justifyContent: 'center', width: '100%' },
  thumbPlaceholderText: { color: colors.mustard, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: '800' },
  percent: { color: colors.blue, fontWeight: '800' },
  excerpt: { color: colors.muted, lineHeight: 20 },
  track: { backgroundColor: colors.border, borderRadius: 4, height: 7, overflow: 'hidden' },
  bar: { backgroundColor: colors.mustard, height: 7 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primary: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 46 },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondary: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  secondaryText: { color: colors.blue, fontWeight: '900' },
  empty: { color: colors.muted, textAlign: 'center' },
});
