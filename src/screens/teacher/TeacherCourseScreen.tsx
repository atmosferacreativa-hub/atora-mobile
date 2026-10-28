import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchTeacherLessons, updateTeacherLesson } from '../../api/teacher';
import { newEventId } from '../../offline/outbox/runtime';
import { useNetworkState } from '../../hooks/useNetworkState';
import { DUE_TIMES, hasDeadline, initialDue, shiftDate } from '../../teacher/lessons';
import { colors, radius, spacing } from '../../theme';
import type { TeacherLesson } from '../../teacher/types';
import { locale, t, tk } from '../../i18n';

type Props = {
  token: string;
  courseId: number;
  title: string;
  onBack: () => void;
  onOpenLesson: (lessonId: number) => void;
  onOpenStudents: () => void;
  onAnnounce: () => void;
  onAttendance: () => void;
};

const TYPE_LABELS: Record<string, string> = {
  tarea: tk('Tarea'),
  quiz: tk('Cuestionario'),
  proyecto: tk('Proyecto'),
  lectura: tk('Lección'),
  video: tk('Video'),
  foro: tk('Foro'),
};

function formatDue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

/** 1.3.0: curso del docente — lecciones (también ocultas), estudiantes y aviso; publicar, ocultar y cambiar fechas. */
export function TeacherCourseScreen({ token, courseId, title, onBack, onOpenLesson, onOpenStudents, onAnnounce, onAttendance }: Props) {
  const network = useNetworkState();
  const offline = network.isConnected === false;
  const [items, setItems] = useState<TeacherLesson[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTeacherLessons(token, courseId);
      setItems(result.data.items);
      setCanManage(result.data.can_manage);
      setFromCache(result.fromCache);
      setError('');
    } catch {
      setError(t('No pudimos cargar las lecciones. Conéctate para sincronizar.'));
    } finally {
      setLoading(false);
    }
  }, [token, courseId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const replace = (lesson: TeacherLesson) => setItems((current) => (current ?? []).map((item) => (item.id === lesson.id ? { ...item, ...lesson } : item)));

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Volver')} onPress={onBack} hitSlop={12} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryStrong} />
        </Pressable>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onOpenStudents} style={styles.action} testID="teacher-course-students">
          <Ionicons name="people-outline" size={18} color={colors.primaryStrong} />
          <Text style={styles.actionText}>{t('Estudiantes')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAnnounce} style={styles.action} testID="teacher-announce">
          <Ionicons name="megaphone-outline" size={18} color={colors.primaryStrong} />
          <Text style={styles.actionText}>{t('Aviso al grupo')}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={onAttendance} style={styles.action} testID="teacher-attendance">
        <Ionicons name="checkbox-outline" size={18} color={colors.primaryStrong} />
        <Text style={styles.actionText}>{t('Tomar asistencia')}</Text>
      </Pressable>
      <Text style={styles.eyebrow}>{t('CONTENIDO')}</Text>
      {fromCache ? <Text style={styles.sync}>{t('Sin conexión · lo último sincronizado')}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!items && !error ? <ActivityIndicator color={colors.primary} /> : null}
      {items && !items.length ? <Text style={styles.empty}>{t('Este curso todavía no tiene lecciones.')}</Text> : null}
      {(items ?? []).map((lesson) => (
        <View key={lesson.id || lesson.wp_id} style={styles.card}>
          <Pressable accessibilityRole="button" onPress={() => lesson.id && onOpenLesson(lesson.id)} style={styles.row} disabled={!lesson.id}>
            <View style={styles.rowText}>
              <Text style={styles.lessonTitle}>{lesson.title}</Text>
              <Text style={styles.meta}>
                {t(TYPE_LABELS[lesson.type] ?? tk('Lección'))}
                {lesson.due_at ? ` · ${t('Vence {date}', { date: formatDue(lesson.due_at) })}` : ''}
                {lesson.pending_submissions ? ` · ${t('{count} por calificar', { count: lesson.pending_submissions })}` : ''}
              </Text>
              <View style={styles.chips}>
                {!lesson.visible ? <Text style={[styles.chip, styles.chipHidden]}>{t('Oculta')}</Text> : null}
                {lesson.live ? <Text style={styles.chip}>{t('En vivo · {provider}', { provider: lesson.live.provider_label })}</Text> : null}
                {lesson.in_person ? <Text style={styles.chip}>{t('Presencial')}</Text> : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          {canManage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={open === lesson.id ? t('Cerrar {title}', { title: lesson.title }) : t('Gestionar {title}', { title: lesson.title })}
              onPress={() => setOpen(open === lesson.id ? null : lesson.id)}
              style={styles.manage}
            >
              <Text style={styles.manageText}>{open === lesson.id ? t('Cerrar') : t('Gestionar')}</Text>
            </Pressable>
          ) : null}
          {open === lesson.id ? <ManagePanel token={token} lesson={lesson} offline={offline} onSaved={replace} /> : null}
        </View>
      ))}
    </ScrollView>
  );
}

function ManagePanel({ token, lesson, offline, onSaved }: { token: string; lesson: TeacherLesson; offline: boolean; onSaved: (lesson: TeacherLesson) => void }) {
  const start = initialDue(lesson);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async (change: Parameters<typeof updateTeacherLesson>[2], done: string) => {
    setBusy(true);
    setMessage('');
    try {
      onSaved(await updateTeacherLesson(token, lesson.id, change, newEventId()));
      setMessage(done);
    } catch (reason) {
      setMessage(reason instanceof Error && reason.message ? reason.message : t('No se pudo guardar. Inténtalo de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  if (offline) {
    return <Text style={styles.offline}>{t('Sin conexión: publicar, ocultar y cambiar fechas necesitan conexión.')}</Text>;
  }

  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void run({ visible: !lesson.visible }, lesson.visible ? t('Lección oculta para los estudiantes.') : t('Lección publicada.'))}
        style={styles.panelButton}
      >
        <Text style={styles.panelButtonText}>{lesson.visible ? t('Ocultar a los estudiantes') : t('Publicar')}</Text>
      </Pressable>

      {hasDeadline(lesson) ? (
        <View style={styles.due}>
          <Text style={styles.dueLabel}>{t('Fecha de entrega')}</Text>
          <View style={styles.stepper}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Un día antes')} onPress={() => setDate(shiftDate(date, -1))} style={styles.step}>
              <Text style={styles.stepText}>−1</Text>
            </Pressable>
            <Text style={styles.dueValue} testID="teacher-due-date">{date}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Un día después')} onPress={() => setDate(shiftDate(date, 1))} style={styles.step}>
              <Text style={styles.stepText}>+1</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Una semana después')} onPress={() => setDate(shiftDate(date, 7))} style={styles.step}>
              <Text style={styles.stepText}>+7</Text>
            </Pressable>
          </View>
          <View style={styles.times}>
            {DUE_TIMES.map((option) => (
              <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: time === option }} onPress={() => setTime(option)} style={[styles.time, time === option && styles.timeOn]}>
                <Text style={[styles.timeText, time === option && styles.timeTextOn]}>{option}</Text>
              </Pressable>
            ))}
          </View>
          {lesson.site_timezone ? <Text style={styles.meta}>{t('Hora de la academia ({zone})', { zone: lesson.site_timezone })}</Text> : null}
          <View style={styles.notify}>
            <Text style={styles.notifyText}>{t('Avisar al curso')}</Text>
            <Switch value={notify} onValueChange={setNotify} accessibilityLabel={t('Avisar al curso')} testID="teacher-due-notify" />
          </View>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run({ due_date: date, due_time: time, notify }, t('Fecha de entrega actualizada.'))} style={styles.save}>
            <Text style={styles.saveText}>{t('Guardar fecha')}</Text>
          </Pressable>
        </View>
      ) : null}
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
      {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  back: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, flex: 1, fontSize: 22, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { alignItems: 'center', borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 44, padding: spacing.sm, backgroundColor: colors.surface },
  actionText: { color: colors.primaryStrong, fontWeight: '800' },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginTop: spacing.sm },
  sync: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.danger },
  empty: { color: colors.textMuted },
  offline: { color: colors.textMuted, padding: spacing.sm },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  rowText: { flex: 1, gap: 4 },
  lessonTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, color: colors.primaryStrong, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  chipHidden: { backgroundColor: colors.accentSoft, color: colors.accentText },
  manage: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  manageText: { color: colors.primary, fontWeight: '800' },
  panel: { borderTopColor: colors.line, borderTopWidth: 1, gap: spacing.sm, paddingTop: spacing.sm },
  panelButton: { alignItems: 'center', borderColor: colors.primary, borderRadius: radius.sm, borderWidth: 1, minHeight: 44, justifyContent: 'center' },
  panelButtonText: { color: colors.primary, fontWeight: '800' },
  due: { gap: spacing.xs },
  dueLabel: { color: colors.text, fontWeight: '800' },
  stepper: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  step: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, justifyContent: 'center', minHeight: 44, minWidth: 44 },
  stepText: { color: colors.primaryStrong, fontWeight: '900' },
  dueValue: { color: colors.text, fontSize: 17, fontWeight: '800', minWidth: 110, textAlign: 'center' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  time: { alignItems: 'center', borderColor: colors.line, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 64, paddingHorizontal: spacing.sm },
  timeOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeText: { color: colors.text, fontWeight: '700' },
  timeTextOn: { color: colors.white },
  notify: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
  notifyText: { color: colors.text },
  save: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.sm, justifyContent: 'center', minHeight: 48 },
  saveText: { color: colors.white, fontWeight: '900' },
  message: { color: colors.text },
});
