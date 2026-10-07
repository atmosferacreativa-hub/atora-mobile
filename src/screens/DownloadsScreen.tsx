import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cachedLesson } from '../api/courses';
import { MediaImage } from '../components/MediaImage';
import { formatBytes, kindOf, type CourseUsage, type DownloadRecord } from '../offline/downloadsMath';
import { getDownloadUsage, removeCourseDownloads, removeDownloadFile, removeLessonAll } from '../offline/mediaDownloads';
import { colors, spacing } from '../theme';
import type { CourseSummary } from '../types';
import { t } from '../i18n';

type Props = { courses: CourseSummary[]; onBack: () => void };

function fileLabel(item: DownloadRecord): string {
  const mime = item.mime ?? '';
  if (mime.includes('pdf') || /\.pdf$/i.test(item.localUri)) return 'PDF';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(item.localUri)) return 'IMG';
  return 'DOC';
}

/** Descargas agrupadas por curso (0.4.0): tamaño por lección, total contra la cuota, borrar por recurso, lección o curso. */
export function DownloadsScreen({ courses, onBack }: Props) {
  const [usage, setUsage] = useState<{ usedBytes: number; maxBytes: number; courses: CourseUsage[] } | null>(null);
  const [lessonTitles, setLessonTitles] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const next = await getDownloadUsage();
    setUsage(next);
    const titles: Record<number, string> = {};
    for (const course of next.courses) {
      for (const lesson of course.lessons) {
        titles[lesson.lessonId] = lesson.title || (await cachedLesson(lesson.lessonId).catch(() => null))?.title || t('Lección {id}', { id: lesson.lessonId });
      }
    }
    setLessonTitles(titles);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const courseTitle = (courseId: number) =>
    courses.find((course) => course.id === courseId)?.title || (courseId ? t('Curso {id}', { id: courseId }) : t('Otras descargas'));

  const confirm = (title: string, message: string, action: () => Promise<void>) => {
    Alert.alert(title, message, [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Eliminar'), style: 'destructive', onPress: () => void action().then(load) },
    ]);
  };

  if (!usage) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  const pct = usage.maxBytes > 0 ? Math.min(100, Math.round((usage.usedBytes / usage.maxBytes) * 100)) : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable hitSlop={12} accessibilityRole="button" onPress={onBack}><Text style={styles.back}>{t('← Volver')}</Text></Pressable>
      <Text style={styles.title}>{t('Descargas')}</Text>
      <View style={styles.quota}>
        <Text style={styles.quotaText}>{t('{used} de {max}', { used: formatBytes(usage.usedBytes) || '0 MB', max: formatBytes(usage.maxBytes) })}</Text>
        <View style={styles.bar}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
      </View>
      {!usage.courses.length ? <Text style={styles.empty}>{t('No hay nada descargado.')}</Text> : null}
      {usage.courses.map((course) => (
        <View key={course.courseId} style={styles.course}>
          <View style={styles.courseHead}>
            <View style={styles.flex}>
              <Text style={styles.courseTitle}>{courseTitle(course.courseId)}</Text>
              <Text style={styles.meta}>{formatBytes(course.bytes)}</Text>
            </View>
            <Pressable hitSlop={12}
              accessibilityRole="button"
              onPress={() => confirm(t('¿Borrar todo el curso?'), t('Se liberan {size}. Seguirá disponible con conexión.', { size: formatBytes(course.bytes) }), () => removeCourseDownloads(course.courseId))}
            >
              <Text style={styles.remove}>{t('Borrar curso')}</Text>
            </Pressable>
          </View>
          {course.lessons.map((lesson) => (
            <View key={lesson.lessonId} style={styles.lesson}>
              <View style={styles.lessonHead}>
                <Text numberOfLines={2} style={styles.lessonTitle}>{lessonTitles[lesson.lessonId] ?? ''}</Text>
                <Text style={styles.meta}>{formatBytes(lesson.bytes)}</Text>
                <Pressable hitSlop={12} accessibilityRole="button" onPress={() => void removeLessonAll(lesson.lessonId).then(load)}>
                  <Text style={styles.remove}>{t('Borrar')}</Text>
                </Pressable>
              </View>
              {lesson.items.map((item: DownloadRecord) => (
                <View key={item.localUri} style={styles.item}>
                  {kindOf(item) === 'video'
                    ? <MediaImage play style={styles.thumb} uri={item.thumbnailUrl} />
                    : <View style={styles.fileIcon}><Text style={styles.fileIconText}>{fileLabel(item)}</Text></View>}
                  <View style={styles.flex}>
                    <Text numberOfLines={2} style={styles.itemTitle}>{kindOf(item) === 'video' ? (item.videoKey && item.title ? item.title : t('Video')) : item.title || t('Material')}</Text>
                    <Text style={styles.meta}>{formatBytes(item.size)}{item.updateAvailable ? ` · ${t('Actualización disponible')}` : ''}</Text>
                  </View>
                  <Pressable hitSlop={12} accessibilityRole="button" onPress={() => void removeDownloadFile(item.localUri).then(load)}>
                    <Text style={styles.remove}>{t('Eliminar')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.md, padding: spacing.lg },
  back: { color: colors.blue, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 28, fontWeight: '900' },
  quota: { gap: spacing.xs },
  quotaText: { color: colors.blue, fontWeight: '800' },
  bar: { backgroundColor: colors.surfaceMuted, borderRadius: 6, height: 8, overflow: 'hidden' },
  fill: { backgroundColor: colors.blue, height: 8 },
  empty: { color: colors.muted, textAlign: 'center' },
  course: { backgroundColor: colors.surface, borderRadius: 16, gap: spacing.sm, padding: spacing.md },
  courseHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  courseTitle: { color: colors.navy, fontSize: 18, fontWeight: '900' },
  lesson: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm },
  lessonHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  lessonTitle: { color: colors.ink, flex: 1, fontWeight: '800' },
  item: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  thumb: { borderRadius: 8, width: 88 },
  fileIcon: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 8, height: 50, justifyContent: 'center', width: 88 },
  fileIconText: { color: colors.muted, fontWeight: '900' },
  itemTitle: { color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  remove: { color: colors.red, fontWeight: '800' },
  flex: { flex: 1 },
});
