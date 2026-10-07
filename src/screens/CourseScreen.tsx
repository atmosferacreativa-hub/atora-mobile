import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchCourse } from '../api/courses';
import { getServerCapabilities } from '../api/discovery';
import { downloadCourseMaterial, planCourseMaterial } from '../offline/courseMaterial';
import { formatBytes } from '../offline/downloadsMath';
import { MediaImage } from '../components/MediaImage';
import { ListRow } from '../components/ui';
import { getLocalThumbnail } from '../offline/videoThumbnails';
import { colors, spacing } from '../theme';
import { PendingQuizNotice } from '../components/PendingQuizNotice';
import { usePendingQuizzes } from '../hooks/usePendingQuizzes';
import type { CourseDetail } from '../types';
import { t } from '../i18n';

type Props = {
  courseId: number;
  token: string;
  onBack: () => void;
  onOpenLesson: (lessonId: number) => void;
  /** 0.5.0: notas del curso (solo si el servidor las ofrece). */
  onOpenGrades?: (title: string) => void;
  hasNewGrade?: boolean;
  /** 0.5.2: retomar un quiz de este curso guardado sin entregar. */
  onOpenQuiz?: (lessonId: number) => void;
};

export function CourseScreen({ courseId, token, onBack, onOpenLesson, onOpenGrades, hasNewGrade, onOpenQuiz }: Props) {
  const pendingQuizzes = usePendingQuizzes();
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
    setMaterial(t('Calculando…'));
    const plan = await planCourseMaterial(data.curriculum.map((lesson) => lesson.id), token).catch(() => null);
    setMaterial('');
    if (!plan || !plan.items.length) {
      Alert.alert(t('Material del curso'), plan ? t('Todo el material descargable ya está en el teléfono.') : t('No se pudo revisar el material.'));
      return;
    }
    const size = plan.totalBytes ? formatBytes(plan.totalBytes) : '';
    const extra = plan.unknownSize ? ` (${t('{count} sin tamaño conocido', { count: plan.unknownSize })})` : '';
    Alert.alert(
      t('Descargar material del curso'),
      `${t('{count} archivo(s)', { count: plan.items.length })}${size ? ` · ${size}` : ''}${extra}. ${t('No incluye videos.')}`,
      [
        { text: t('Cancelar'), style: 'cancel' },
        {
          text: t('Descargar'),
          onPress: () => void (async () => {
            const result = await downloadCourseMaterial(plan, (done, total) => setMaterial(t('Descargando {done} de {total}…', { done: Math.min(done + 1, total), total })));
            setMaterial('');
            Alert.alert(t('Material del curso'), result.error ? `${t('{count} guardado(s).', { count: result.saved })} ${result.error}` : t('{count} archivo(s) guardado(s) para usar sin conexión.', { count: result.saved }));
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
      .catch(() => { if (active) setError(t('No pudimos cargar este curso.')); });
    return () => { active = false; };
  }, [courseId, token]);

  if (!data && !error) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  // 1.0.0: lista virtualizada (cursos con muchas lecciones en teléfonos de gama baja).
  type Row = { kind: 'section'; key: string; title: string } | { kind: 'lesson'; key: string; lesson: CourseDetail['curriculum'][number]; index: number };
  const rows: Row[] = [];
  if (data) {
    const sections = data.curriculum.reduce<Record<string, CourseDetail['curriculum']>>((acc, lesson) => {
      const key = lesson.section?.trim() || '';
      (acc[key] ??= []).push(lesson);
      return acc;
    }, {});
    for (const [section, lessons] of Object.entries(sections)) {
      rows.push({ kind: 'section', key: `s-${section}`, title: section || t('Contenido') });
      lessons.forEach((lesson, index) => rows.push({ kind: 'lesson', key: `l-${lesson.id}`, lesson, index }));
    }
  }

  const header = (
    <View style={styles.header}>
      <Pressable hitSlop={12} onPress={onBack}><Text style={styles.back}>{t('← Mis cursos')}</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data ? (
        <>
          <Text style={styles.title}>{data.course.title}</Text>
          <Text style={styles.excerpt}>{data.course.excerpt}</Text>
          <View style={styles.progressCard}>
            <Text style={styles.progressValue}>{data.progress.progress_pct}%</Text>
            <Text style={styles.progressLabel}>
              {t('{done} de {total} lecciones', { done: data.progress.completed_lessons, total: data.progress.total_lessons })}
            </Text>
          </View>
          {onOpenQuiz ? pendingQuizzes
            .filter((item) => data.curriculum.some((lesson) => lesson.id === item.lessonId))
            .map((item) => <PendingQuizNotice key={item.lessonId} item={item} onOpen={() => onOpenQuiz(item.lessonId)} />) : null}
          {onOpenGrades ? (
            <Pressable accessibilityRole="button" onPress={() => onOpenGrades(data.course.title)} style={styles.gradesButton}>
              <Text style={styles.materialText}>{t('Notas')}</Text>
              {hasNewGrade ? <Text style={styles.newBadge}>{t('Nota nueva')}</Text> : null}
            </Pressable>
          ) : null}
          {materialSupported && data.curriculum.length ? (
            <Pressable accessibilityRole="button" disabled={Boolean(material)} onPress={() => void downloadMaterial()} style={styles.materialButton}>
              {material ? (
                <View style={styles.materialBusy}><ActivityIndicator color={colors.blue} /><Text style={styles.materialText}>{material}</Text></View>
              ) : (
                <Text style={styles.materialText}>{t('Descargar material del curso')}</Text>
              )}
            </Pressable>
          ) : null}
          <Text style={styles.heading}>{t('Contenido')}</Text>
          {!data.curriculum.length ? <Text style={styles.empty}>{t('Este curso todavía no tiene lecciones publicadas.')}</Text> : null}
        </>
      ) : null}
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) => row.key}
      ListHeaderComponent={header}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews
      renderItem={({ item }) => item.kind === 'section' ? (
        <Text style={[styles.sectionTitle, styles.section]}>{item.title}</Text>
      ) : (
        <ListRow
          onPress={() => onOpenLesson(item.lesson.id)}
          subtitle={`${item.lesson.type} · ${t('{count} min', { count: item.lesson.duration_min })}`}
          title={item.lesson.title}
          leading={item.lesson.has_video ? (
            <View style={styles.thumbWrap}>
              <MediaImage
                badge={(item.lesson.video_count ?? 0) > 1 ? t('{count} videos', { count: item.lesson.video_count ?? 0 }) : item.lesson.duration_min ? t('{count} min', { count: item.lesson.duration_min }) : undefined}
                play
                style={styles.thumb}
                uri={localThumbs[item.lesson.id] || item.lesson.video_thumbnail_url}
              />
              {item.lesson.completed ? <Text style={styles.thumbDone}>✓</Text> : null}
            </View>
          ) : (
            <View style={[styles.number, item.lesson.completed && styles.done]}>
              <Text style={styles.numberText}>{item.lesson.completed ? '✓' : item.index + 1}</Text>
            </View>
          )}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  materialButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 46, padding: spacing.sm },
  materialBusy: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  materialText: { color: colors.blue, fontWeight: '800' },
  gradesButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', padding: spacing.md },
  newBadge: { backgroundColor: colors.mustard, borderRadius: 10, color: colors.navy, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.sm, padding: spacing.lg },
  header: { gap: spacing.md, marginBottom: spacing.xs },
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
