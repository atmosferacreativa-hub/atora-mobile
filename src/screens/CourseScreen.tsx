import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCourse } from '../api/courses';
import { colors, spacing } from '../theme';
import type { CourseDetail } from '../types';

type Props = {
  courseId: number;
  token: string;
  onBack: () => void;
  onOpenLesson: (lessonId: number) => void;
};

export function CourseScreen({ courseId, token, onBack, onOpenLesson }: Props) {
  const [data, setData] = useState<CourseDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchCourse(courseId, token)
      .then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setError('No pudimos cargar este curso.'); });
    return () => { active = false; };
  }, [courseId, token]);

  if (!data && !error) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack}><Text style={styles.back}>← Mis cursos</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data ? (
        <>
          <Text style={styles.title}>{data.course.title}</Text>
          <Text style={styles.excerpt}>{data.course.excerpt}</Text>
          <View style={styles.progressCard}>
            <Text style={styles.progressValue}>{data.progress.progress_pct}%</Text>
            <Text style={styles.progressLabel}>
              {data.progress.completed_lessons} de {data.progress.total_lessons} lecciones
            </Text>
          </View>
          <Text style={styles.heading}>Contenido</Text>
          {data.curriculum.map((lesson, index) => (
            <Pressable key={lesson.id} onPress={() => onOpenLesson(lesson.id)} style={styles.lesson}>
              <View style={[styles.number, lesson.completed && styles.done]}>
                <Text style={styles.numberText}>{lesson.completed ? '✓' : index + 1}</Text>
              </View>
              <View style={styles.lessonText}>
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                <Text style={styles.meta}>{lesson.type} · {lesson.duration_min} min</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.md, padding: spacing.lg },
  back: { color: colors.blue, fontWeight: '800' },
  error: { color: colors.red },
  title: { color: colors.navy, fontSize: 28, fontWeight: '900' },
  excerpt: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  progressCard: { backgroundColor: colors.navy, borderRadius: 16, padding: spacing.lg },
  progressValue: { color: colors.mustard, fontSize: 34, fontWeight: '900' },
  progressLabel: { color: colors.white },
  heading: { color: colors.navy, fontSize: 20, fontWeight: '800' },
  lesson: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  number: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  done: { backgroundColor: colors.success },
  numberText: { color: colors.white, fontWeight: '900' },
  lessonText: { flex: 1 },
  lessonTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  chevron: { color: colors.blue, fontSize: 28 },
});
