import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCourse } from '../api/courses';
import { fetchProgram } from '../api/programs';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { colors, spacing } from '../theme';
import type { ProgramDetail } from '../types';

type Props = {
  programId: number;
  token: string;
  onBack: () => void;
  onOpenCourse: (courseId: number) => void;
  onOpenLesson: (lessonId: number) => void;
};

export function ProgramScreen({ programId, token, onBack, onOpenCourse, onOpenLesson }: Props) {
  const [data, setData] = useState<ProgramDetail | null>(null);
  const [error, setError] = useState('');
  const [continuingId, setContinuingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchProgram(programId, token)
      .then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setError('No pudimos cargar este programa.'); });
    return () => { active = false; };
  }, [programId, token]);

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

  if (!data && !error) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  const program = data?.program;
  const outcomes = program?.meta?.learning_outcomes ?? [];
  const exitProfile = program?.meta?.exit_profile ?? [];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack}><Text style={styles.back}>← Volver</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {program ? (
        <>
          {program.thumbnail_url ? <Image source={{ uri: resolveMediaUrl(program.thumbnail_url) }} style={styles.hero} /> : null}
          <Text style={styles.title}>{program.title}</Text>
          {program.subtitle ? <Text style={styles.subtitle}>{program.subtitle}</Text> : null}

          {(outcomes.length || exitProfile.length) ? (
            <View style={styles.metaCard}>
              {outcomes.length ? (
                <>
                  <Text style={styles.metaTitle}>Qué aprenderás</Text>
                  {outcomes.slice(0, 6).map((item) => (
                    <Text key={item} style={styles.bullet}>• {item}</Text>
                  ))}
                </>
              ) : null}
              {exitProfile.length ? (
                <>
                  <Text style={styles.metaTitle}>Perfil de egreso</Text>
                  {exitProfile.slice(0, 6).map((item) => (
                    <Text key={item} style={styles.bullet}>• {item}</Text>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.heading}>Cursos del programa</Text>
          {(data.courses ?? []).map((course) => (
            <View key={course.id} style={styles.courseCard}>
              {course.thumbnail_url ? <Image source={{ uri: resolveMediaUrl(course.thumbnail_url) }} style={styles.thumb} /> : null}
              <View style={styles.courseTop}>
                <Text style={styles.courseTitle}>{course.title}</Text>
                <Text style={styles.percent}>{course.progress}%</Text>
              </View>
              <Text style={styles.courseMeta}>{course.completed_lessons} de {course.total_lessons} lecciones</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => void continueCourse(course.id)} style={styles.primary}>
                  {continuingId === course.id ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{course.progress > 0 ? 'Continuar' : 'Empezar'}</Text>}
                </Pressable>
                <Pressable onPress={() => onOpenCourse(course.id)} style={styles.secondary}>
                  <Text style={styles.secondaryText}>Ver temario</Text>
                </Pressable>
              </View>
            </View>
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
  hero: { backgroundColor: colors.border, borderRadius: 16, height: 180, width: '100%' },
  title: { color: colors.navy, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  metaCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  metaTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginTop: spacing.xs },
  bullet: { color: colors.ink, lineHeight: 20 },
  heading: { color: colors.navy, fontSize: 20, fontWeight: '900' },
  courseCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  thumb: { backgroundColor: colors.border, borderRadius: 12, height: 130, width: '100%' },
  courseTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  courseTitle: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: '900' },
  percent: { color: colors.blue, fontWeight: '900' },
  courseMeta: { color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  primary: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 46 },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondary: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  secondaryText: { color: colors.blue, fontWeight: '900' },
});

