import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCourse } from '../api/courses';
import { getServerCapabilities } from '../api/discovery';
import { downloadCourseMaterial, planCourseMaterial } from '../offline/courseMaterial';
import { formatBytes } from '../offline/downloadsMath';
import { MediaImage } from '../components/MediaImage';
import { ListRow } from '../components/ui';
import { getLocalThumbnail } from '../offline/videoThumbnails';
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
  const [localThumbs, setLocalThumbs] = useState<Record<number, string>>({});
  const [materialSupported, setMaterialSupported] = useState(false);
  const [material, setMaterial] = useState('');

  useEffect(() => {
    let active = true;
    void getServerCapabilities().then((caps) => { if (active) setMaterialSupported(Boolean(caps.resource_downloads)); });
    return () => { active = false; };
  }, []);

  const downloadMaterial = async () => {
    if (!data || material) return;
    setMaterial('Calculando…');
    const plan = await planCourseMaterial(data.curriculum.map((lesson) => lesson.id), token).catch(() => null);
    setMaterial('');
    if (!plan || !plan.items.length) {
      Alert.alert('Material del curso', plan ? 'Todo el material descargable ya está en el teléfono.' : 'No se pudo revisar el material.');
      return;
    }
    const size = plan.totalBytes ? formatBytes(plan.totalBytes) : '';
    const extra = plan.unknownSize ? ` (${plan.unknownSize} sin tamaño conocido)` : '';
    Alert.alert(
      'Descargar material del curso',
      `${plan.items.length} archivo(s)${size ? ` · ${size}` : ''}${extra}. No incluye videos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descargar',
          onPress: () => void (async () => {
            const result = await downloadCourseMaterial(plan, (done, total) => setMaterial(`Descargando ${Math.min(done + 1, total)} de ${total}…`));
            setMaterial('');
            Alert.alert('Material del curso', result.error ? `${result.saved} guardado(s). ${result.error}` : `${result.saved} archivo(s) guardado(s) para usar sin conexión.`);
          })(),
        },
      ],
    );
  };

  useEffect(() => {
    let active = true;
    fetchCourse(courseId, token)
      .then(async (value) => {
        if (!active) return;
        setData(value);
        // Miniaturas generadas en el teléfono (MP4 propios ya vistos).
        const entries = await Promise.all(
          value.curriculum.filter((lesson) => lesson.has_video).map(async (lesson) => [lesson.id, await getLocalThumbnail(lesson.id)] as const),
        );
        if (active) setLocalThumbs(Object.fromEntries(entries.filter(([, uri]) => uri)) as Record<number, string>);
      })
      .catch(() => { if (active) setError('No pudimos cargar este curso.'); });
    return () => { active = false; };
  }, [courseId, token]);

  if (!data && !error) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  const sections = data
    ? data.curriculum.reduce<Record<string, CourseDetail['curriculum']>>((acc, lesson) => {
        const key = lesson.section?.trim() || 'Contenido';
        (acc[key] ??= []).push(lesson);
        return acc;
      }, {})
    : {};

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
          {materialSupported && data.curriculum.length ? (
            <Pressable accessibilityRole="button" disabled={Boolean(material)} onPress={() => void downloadMaterial()} style={styles.materialButton}>
              {material ? (
                <View style={styles.materialBusy}><ActivityIndicator color={colors.blue} /><Text style={styles.materialText}>{material}</Text></View>
              ) : (
                <Text style={styles.materialText}>Descargar material del curso</Text>
              )}
            </Pressable>
          ) : null}
          <Text style={styles.heading}>Contenido</Text>
          {!data.curriculum.length ? (
            <Text style={styles.empty}>Este curso todavía no tiene lecciones publicadas.</Text>
          ) : (
            Object.entries(sections).map(([section, lessons]) => (
              <View key={section} style={styles.section}>
                <Text style={styles.sectionTitle}>{section}</Text>
                {lessons.map((lesson, index) => (
                  <ListRow
                    key={lesson.id}
                    onPress={() => onOpenLesson(lesson.id)}
                    subtitle={`${lesson.type} · ${lesson.duration_min} min`}
                    title={lesson.title}
                    leading={lesson.has_video ? (
                      <View style={styles.thumbWrap}>
                        <MediaImage
                          badge={(lesson.video_count ?? 0) > 1 ? `${lesson.video_count} videos` : lesson.duration_min ? `${lesson.duration_min} min` : undefined}
                          play
                          style={styles.thumb}
                          uri={localThumbs[lesson.id] || lesson.video_thumbnail_url}
                        />
                        {lesson.completed ? <Text style={styles.thumbDone}>✓</Text> : null}
                      </View>
                    ) : (
                      <View style={[styles.number, lesson.completed && styles.done]}>
                        <Text style={styles.numberText}>{lesson.completed ? '✓' : index + 1}</Text>
                      </View>
                    )}
                  />
                ))}
              </View>
            ))
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  materialButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 46, padding: spacing.sm },
  materialBusy: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  materialText: { color: colors.blue, fontWeight: '800' },
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
  empty: { color: colors.muted, fontSize: 14 },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  number: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  done: { backgroundColor: colors.success },
  numberText: { color: colors.white, fontWeight: '900' },
  thumbWrap: { width: 120 },
  thumb: { borderRadius: 10 },
  thumbDone: { backgroundColor: colors.success, borderRadius: 10, color: colors.white, fontSize: 11, fontWeight: '900', left: 6, overflow: 'hidden', paddingHorizontal: 5, position: 'absolute', top: 6 },
});
