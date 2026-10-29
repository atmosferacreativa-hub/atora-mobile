import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchCourse } from '../api/courses';
import { downloadHistory } from '../api/history';
import { groupCourses } from '../courses/periods';
import { fetchPrograms } from '../api/programs';
import { MediaImage } from '../components/MediaImage';
import { colors, spacing } from '../theme';
import type { CourseSummary, ProgramSummary } from '../types';
import { t } from '../i18n';

type Props = {
  courses: CourseSummary[];
  token: string;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenCourse: (courseId: number) => void;
  onOpenLesson: (lessonId: number) => void;
  onOpenProgram: (programId: number) => void;
  /** 1.4.0 (plugin 6.41.0): abre el historial académico descargado. */
  onOpenHistory?: (title: string, localUri: string) => void;
};

export function CoursesScreen({ courses, token, onOpenCourse, onOpenLesson, onOpenProgram, onOpenHistory, onRefresh, refreshing }: Props) {
  const [continuingId, setContinuingId] = useState<number | null>(null);
  const [openPeriods, setOpenPeriods] = useState<Record<number, boolean>>({});
  const [history, setHistory] = useState<'idle' | 'loading' | 'error'>('idle');
  const { active, past } = groupCourses(courses);
  // El historial existe desde el plugin 6.41.0, el mismo que manda `period` en cada curso.
  const historyAvailable = Boolean(onOpenHistory) && courses.some((course) => course.period !== undefined);

  const openHistory = async () => {
    if (!onOpenHistory) return;
    setHistory('loading');
    try {
      onOpenHistory(t('Historial académico'), await downloadHistory(token));
      setHistory('idle');
    } catch {
      setHistory('error');
    }
  };
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);

  useEffect(() => {
    let active = true;
    fetchPrograms(token)
      .then((items) => { if (active) setPrograms(items); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [token]);

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
      <Text style={styles.title}>{t('Mis cursos')}</Text>
      <Text style={styles.subtitle}>{t('Contenido nativo disponible desde tu academia.')}</Text>
      {programs.length ? (
        <View style={styles.programWrap}>
          <Text style={styles.programHeading}>{t('Programas')}</Text>
          {programs.map((program) => (
            <Pressable key={program.id} onPress={() => onOpenProgram(program.id)} style={styles.programCard}>
              <MediaImage style={styles.programThumb} uri={program.thumbnail_url} />
              <View style={styles.programCopy}>
                <Text style={styles.programTitle}>{program.title}</Text>
                <Text numberOfLines={2} style={styles.programText}>{program.subtitle || program.excerpt || t('Programa académico')}</Text>
                <Text style={styles.programCta}>{t('Abrir programa →')}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {active.map((course) => (
        <Pressable key={course.id} onPress={() => onOpenCourse(course.id)} style={styles.card}>
          {course.color ? <View style={[styles.colorStrip, { backgroundColor: course.color }]} /> : null}
          <MediaImage uri={course.thumbnail_url} />
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{course.title}</Text>
            <Text style={styles.percent}>{course.progress}%</Text>
          </View>
          <Text numberOfLines={2} style={styles.excerpt}>{course.excerpt || t('Continúa tu recorrido formativo.')}</Text>
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
                <Text style={styles.primaryText}>{course.progress > 0 ? t('Continuar') : t('Empezar')}</Text>
              )}
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onOpenCourse(course.id)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{t('Ver temario')}</Text>
            </Pressable>
          </View>
        </Pressable>
      ))}
      {!active.length ? <Text style={styles.empty}>{t('No hay cursos activos.')}</Text> : null}
      {past.length || historyAvailable ? (
        <View style={styles.pastWrap}>
          {past.length ? <Text style={styles.programHeading}>{t('Períodos anteriores')}</Text> : null}
          {past.map(({ period, courses: items }) => {
            const open = Boolean(openPeriods[period.id]);
            const dates = [period.starts_on, period.ends_on].filter(Boolean).join(' – ');
            return (
              <View key={period.id} style={styles.periodCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={t('{name}, {count} cursos', { name: period.name, count: items.length })}
                  onPress={() => setOpenPeriods((current) => ({ ...current, [period.id]: !open }))}
                  style={styles.periodHeader}
                  testID={`period-${period.id}`}
                >
                  <View style={styles.periodCopy}>
                    <Text style={styles.periodTitle}>{period.name}</Text>
                    <Text style={styles.periodMeta}>
                      {t('{count} cursos', { count: items.length })}{dates ? ` · ${dates}` : ''}
                      {period.visible_until ? ` · ${t('Disponible hasta {date}', { date: period.visible_until })}` : ''}
                    </Text>
                  </View>
                  <Ionicons color={colors.textMuted} name={open ? 'chevron-up' : 'chevron-down'} size={22} />
                </Pressable>
                {open ? items.map((course) => (
                  <View key={course.id} style={styles.pastRow}>
                    <View style={[styles.pastSwatch, { backgroundColor: course.color || colors.surfaceMuted }]} />
                    <View style={styles.periodCopy}>
                      <Text numberOfLines={2} style={styles.pastTitle}>{course.title}</Text>
                      <Text style={styles.periodMeta}>{t('{progress}% completado', { progress: course.progress })}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('Repasar {title}', { title: course.title })} onPress={() => onOpenCourse(course.id)} style={styles.pastAction}>
                      <Text style={styles.secondaryText}>{t('Repasar')}</Text>
                    </Pressable>
                  </View>
                )) : null}
              </View>
            );
          })}
          {historyAvailable ? (
            <Pressable accessibilityRole="button" onPress={() => void openHistory()} style={styles.secondary} testID="history-download">
              {history === 'loading' ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryText}>{t('Descargar mi historial (PDF)')}</Text>}
            </Pressable>
          ) : null}
          {history === 'error' ? <Text style={styles.error}>{t('No se pudo descargar el historial. Revisa tu conexión e inténtalo otra vez.')}</Text> : null}
        </View>
      ) : null}
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
  actions: { flexDirection: 'row', gap: spacing.sm },
  primary: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 46 },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondary: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  secondaryText: { color: colors.blue, fontWeight: '900' },
  empty: { color: colors.muted, textAlign: 'center' },
  programWrap: { gap: spacing.sm },
  programHeading: { color: colors.navy, fontSize: 18, fontWeight: '900', marginTop: spacing.sm },
  programCard: { minHeight: 44, backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: spacing.md, overflow: 'hidden' },
  programThumb: { borderRadius: 0, width: 140 },
  programCopy: { flex: 1, gap: 4, padding: spacing.md },
  programTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  programText: { color: colors.muted, lineHeight: 18 },
  programCta: { color: colors.blue, fontWeight: '900', marginTop: 4 },
  colorStrip: { borderRadius: 999, height: 4, width: 48 },
  pastWrap: { gap: spacing.sm },
  periodCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  periodHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 56, padding: spacing.md },
  periodCopy: { flex: 1, gap: 2 },
  periodTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  periodMeta: { color: colors.textMuted, fontSize: 14, fontVariant: ['tabular-nums'] },
  pastRow: { alignItems: 'center', borderColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  pastSwatch: { borderRadius: 8, height: 40, width: 8 },
  pastTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  pastAction: { alignItems: 'center', borderColor: colors.primary, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  error: { color: colors.danger, textAlign: 'center' },
});
