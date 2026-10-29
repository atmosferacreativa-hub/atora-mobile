import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAttendance, pendingAttendance, saveAttendance } from '../../api/teacher';
import { subscribeOutbox } from '../../offline/outbox/runtime';
import { buildMarks, counts, markAllPresent, withPending, type AttendancePayload, type AttendanceRoster, type AttendanceStatus, type LocalMarks } from '../../teacher/attendance';
import { shiftDate, todayIn } from '../../teacher/lessons';
import { colors, radius, spacing } from '../../theme';
import { t, tk } from '../../i18n';

type Props = { token: string; courseId: number; title: string; onBack: () => void };

const LABELS: Record<AttendanceStatus, { short: string; long: string; color: string }> = {
  presente: { short: tk('P'), long: tk('Presente'), color: colors.success },
  tarde: { short: tk('T'), long: tk('Tarde'), color: colors.accentText },
  ausente: { short: tk('A'), long: tk('Ausente'), color: colors.danger },
  justificado: { short: tk('J'), long: tk('Justificado'), color: colors.primary },
};
const ORDER: AttendanceStatus[] = ['presente', 'tarde', 'ausente', 'justificado'];

/**
 * 1.3.0: tomar lista en el aula. Funciona sin señal: guardar deja las marcas en la cola del teléfono (con la hora en
 * que se tomaron) y salen al volver la conexión. La lista se abre sin conexión con lo último sincronizado del curso.
 */
export function TeacherAttendanceScreen({ token, courseId, title, onBack }: Props) {
  const [date, setDate] = useState<string>(() => todayIn(undefined));
  const [lessonId, setLessonId] = useState(0);
  const [roster, setRoster] = useState<AttendanceRoster | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [local, setLocal] = useState<LocalMarks>({});
  const [pending, setPending] = useState<{ id: string; status: 'pending' | 'failed'; lastError: string; payload: AttendancePayload }[]>([]);
  const [message, setMessage] = useState('');

  const loadPending = useCallback(() => {
    void pendingAttendance(courseId).then(setPending).catch(() => undefined);
  }, [courseId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAttendance(token, courseId, date, lessonId);
      let data = result.data;
      // Sin conexión, la caché puede ser de otro día: se usan sus estudiantes, sin marcas.
      if (result.fromCache && (data.session.date !== date || data.session.lesson_id !== lessonId)) {
        data = { ...data, session: { ...data.session, id: 0, date, lesson_id: lessonId }, students: data.students.map((s) => ({ ...s, status: null, note: '', marked_at: null })) };
      }
      setRoster(data);
      setFromCache(result.fromCache);
      setError('');
      if (!result.fromCache && data.today && date === todayIn(undefined) && data.today !== date) setDate(data.today);
    } catch {
      setError(t('No pudimos cargar la lista. Conéctate una vez para guardarla en el teléfono.'));
    } finally {
      setLoading(false);
    }
  }, [token, courseId, date, lessonId]);

  useEffect(() => { setLocal({}); setMessage(''); void load(); }, [load]);
  useEffect(() => { loadPending(); return subscribeOutbox(loadPending); }, [loadPending]);

  const shown = useMemo(() => (roster ? withPending(roster, pending.map((p) => p.payload)) : []), [roster, pending]);
  const view = shown.map((student) => {
    const edit = local[student.id];
    return edit ? { ...student, status: edit.status, note: edit.note } : student;
  });
  const totals = counts(view);
  const marks = roster ? buildMarks(shown, local, new Date().toISOString()) : [];
  const failed = pending.filter((p) => p.status === 'failed');

  const set = (id: number, status: AttendanceStatus) => setLocal((current) => {
    const note = current[id]?.note ?? view.find((s) => s.id === id)?.note ?? '';
    return { ...current, [id]: { status, note } };
  });
  const setNote = (id: number, note: string) => setLocal((current) => {
    const status: AttendanceStatus = current[id]?.status ?? view.find((s) => s.id === id)?.status ?? 'justificado';
    return { ...current, [id]: { status, note } };
  });

  const save = async () => {
    if (!marks.length) return;
    await saveAttendance(courseId, lessonId, date, marks);
    setLocal({});
    setMessage(t('Asistencia guardada en el teléfono. Se envía al tener conexión.'));
    loadPending();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Volver')} onPress={onBack} hitSlop={12} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryStrong} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t('ASISTENCIA')}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Día anterior')} onPress={() => setDate(shiftDate(date, -1))} style={styles.step}>
          <Ionicons name="chevron-back" size={20} color={colors.primaryStrong} />
        </Pressable>
        <Text style={styles.date} testID="attendance-date">{date}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Día siguiente')} onPress={() => setDate(shiftDate(date, 1))} style={styles.step}>
          <Ionicons name="chevron-forward" size={20} color={colors.primaryStrong} />
        </Pressable>
      </View>

      {roster?.in_person_lessons?.length ? (
        <View style={styles.lessons}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: lessonId === 0 }} onPress={() => setLessonId(0)} style={[styles.lessonChip, lessonId === 0 && styles.lessonChipOn]}>
            <Text style={[styles.lessonChipText, lessonId === 0 && styles.lessonChipTextOn]}>{t('Clase del día')}</Text>
          </Pressable>
          {roster.in_person_lessons.map((lesson) => (
            <Pressable
              key={lesson.id}
              accessibilityRole="button"
              accessibilityState={{ selected: lessonId === lesson.id }}
              onPress={() => { setLessonId(lesson.id); if (lesson.date) setDate(lesson.date); }}
              style={[styles.lessonChip, lessonId === lesson.id && styles.lessonChipOn]}
            >
              <Text style={[styles.lessonChipText, lessonId === lesson.id && styles.lessonChipTextOn]} numberOfLines={1}>{lesson.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {fromCache ? <Text style={styles.sync}>{t('Sin conexión · lista guardada en el teléfono')}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!roster && !error ? <ActivityIndicator color={colors.primary} /> : null}

      {roster ? (
        <>
          <Text style={styles.totals} testID="attendance-totals">
            {t('Presentes {p} · Tarde {t} · Ausentes {a} · Justificados {j} · Sin marcar {n}', { p: totals.presente, t: totals.tarde, a: totals.ausente, j: totals.justificado, n: totals.sin_marcar })}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setLocal(markAllPresent(shown, local))} style={styles.allPresent}>
            <Text style={styles.allPresentText}>{t('Todos presentes')}</Text>
          </Pressable>
          {!view.length ? <Text style={styles.sync}>{t('Este curso no tiene estudiantes matriculados.')}</Text> : null}
          {view.map((student) => (
            <View key={student.id} style={styles.row}>
              <View style={styles.who}>
                <Avatar person={student} size={36} />
                <Text style={styles.name}>{student.name}</Text>
              </View>
              <View style={styles.buttons}>
                {ORDER.map((status) => {
                  const on = student.status === status;
                  return (
                    <Pressable
                      key={status}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={t('{status} {name}', { status: t(LABELS[status].long), name: student.name })}
                      onPress={() => set(student.id, status)}
                      style={[styles.statusButton, on && { backgroundColor: LABELS[status].color, borderColor: LABELS[status].color }]}
                    >
                      <Text style={[styles.statusText, on && styles.statusTextOn]}>{t(LABELS[status].short)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {student.status === 'tarde' || student.status === 'justificado' ? (
                <TextInput
                  value={student.note}
                  onChangeText={(note) => setNote(student.id, note)}
                  placeholder={t('Nota (opcional)')}
                  accessibilityLabel={t('Nota de {name}', { name: student.name })}
                  style={styles.note}
                  maxLength={255}
                />
              ) : null}
            </View>
          ))}
          <Pressable accessibilityRole="button" disabled={!marks.length} onPress={() => void save()} style={[styles.save, !marks.length && styles.saveOff]} testID="attendance-save">
            <Text style={styles.saveText}>{marks.length ? t('Guardar asistencia ({count})', { count: marks.length }) : t('Sin cambios')}</Text>
          </Pressable>
          {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
          {pending.some((p) => p.status === 'pending') ? <Text style={styles.sync}>{t('Pendiente · se enviará al tener conexión')}</Text> : null}
          {failed.map((item) => (
            <Text key={item.id} style={styles.error}>{t('No se envió: {reason}', { reason: item.lastError || t('el servidor la rechazó') })}</Text>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  who: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  back: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  dateRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  step: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, justifyContent: 'center', minHeight: 44, minWidth: 44 },
  date: { color: colors.text, fontSize: 18, fontWeight: '800', minWidth: 120, textAlign: 'center' },
  lessons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  lessonChip: { borderColor: colors.line, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', maxWidth: '100%', minHeight: 44, paddingHorizontal: spacing.md },
  lessonChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  lessonChipText: { color: colors.text, fontWeight: '700' },
  lessonChipTextOn: { color: colors.white },
  sync: { color: colors.textMuted, fontSize: 13 },
  error: { color: colors.danger },
  totals: { color: colors.textMuted, fontSize: 13 },
  allPresent: { alignItems: 'center', borderColor: colors.success, borderRadius: radius.sm, borderWidth: 1, justifyContent: 'center', minHeight: 44 },
  allPresentText: { color: colors.success, fontWeight: '800' },
  row: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: spacing.xs },
  statusButton: { alignItems: 'center', borderColor: colors.line, borderRadius: radius.sm, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44 },
  statusText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  statusTextOn: { color: colors.white },
  note: { borderColor: colors.line, borderRadius: radius.sm, borderWidth: 1, color: colors.text, minHeight: 44, paddingHorizontal: spacing.sm },
  save: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.sm, justifyContent: 'center', minHeight: 52 },
  saveOff: { opacity: 0.5 },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  message: { color: colors.text },
});
