import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchStudentFile } from '../../api/teacher';
import { RiskBadge } from '../../components/RiskBadge';
import { colors, radius, spacing } from '../../theme';
import type { StudentFile } from '../../teacher/types';
import { locale, t } from '../../i18n';

type Props = {
  token: string;
  studentId: number;
  courseId: number;
  name: string;
  onBack: () => void;
  onWrite: (student: { id: number; name: string; courseId: number }) => void;
};

const STATUS: Record<string, string> = { pending: 'Por calificar', draft: 'En borrador', graded: 'Calificada', late: 'Tardía' };

/** Ficha del estudiante en un curso (0.7.0): avance, notas, entregas y alertas; "Escribir" abre un hilo directo. */
export function TeacherStudentScreen({ token, studentId, courseId, name, onBack, onWrite }: Props) {
  const [data, setData] = useState<StudentFile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStudentFile(token, studentId, courseId)
      .then(setData)
      .catch(() => setError(t('No pudimos cargar la ficha. Conéctate e inténtalo de nuevo.')));
  }, [token, studentId, courseId]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Volver')} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryStrong} />
        </Pressable>
        <Text style={styles.title} numberOfLines={2}>{data?.student.name ?? name}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => onWrite({ id: studentId, name: data?.student.name ?? name, courseId })} style={styles.write} testID="teacher-write">
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.white} />
        <Text style={styles.writeText}>{t('Escribir')}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!data && !error ? <ActivityIndicator color={colors.primary} /> : null}
      {data ? (
        <>
          <Text style={styles.meta}>{data.course.title}</Text>
          <View style={styles.card}>
            <Text style={styles.big}>{t('Avance {percent}%', { percent: data.summary.progress })}</Text>
            <Text style={styles.meta}>{data.summary.final_grade === null ? t('Sin calificaciones') : t('Nota acumulada {grade}/100', { grade: data.summary.final_grade })}</Text>
            {data.summary.last_access ? <Text style={styles.meta}>{t('Último acceso {date}', { date: new Date(data.summary.last_access).toLocaleString(locale()) })}</Text> : null}
            <RiskBadge risk={data.summary.risk} />
          </View>

          <Text style={styles.heading}>{t('Notas')}</Text>
          {data.grades.length ? data.grades.map((grade, index) => (
            <View key={`g-${index}`} style={styles.row}>
              <Text style={[styles.rowTitle, styles.flex]}>{grade.title}</Text>
              <Text style={styles.rowTitle}>{grade.grade === null ? '—' : grade.grade}</Text>
            </View>
          )) : <Text style={styles.meta}>{t('Sin actividades calificables.')}</Text>}

          <Text style={styles.heading}>{t('Entregas')}</Text>
          {data.submissions.length ? data.submissions.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{item.lesson.title}</Text>
                <Text style={styles.meta}>{STATUS[item.status] ?? item.status}{item.submitted_at ? ` · ${new Date(item.submitted_at).toLocaleDateString(locale())}` : ''}</Text>
              </View>
              <Text style={styles.rowTitle}>{item.grade === null ? '' : item.grade}</Text>
            </View>
          )) : <Text style={styles.meta}>{t('Sin entregas.')}</Text>}

          <Text style={styles.heading}>{t('Alertas')}</Text>
          {data.alerts.length ? data.alerts.map((alert, index) => (
            <View key={`a-${index}`} style={styles.row}>
              <Ionicons name="warning-outline" size={18} color={alert.status === 'open' ? colors.danger : colors.textMuted} />
              <Text style={[styles.rowTitle, styles.flex]}>
                {alert.type === 'missed_submission' ? `${alert.count} ${alert.count === 1 ? 'entrega vencida' : 'entregas vencidas'}` : alert.type}
                {alert.status === 'open' ? '' : ` (${t('resuelta')})`}
              </Text>
            </View>
          )) : <Text style={styles.meta}>{t('Sin alertas.')}</Text>}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  title: { color: colors.text, flex: 1, fontSize: 24, fontWeight: '900' },
  write: { minHeight: 44, alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radius.md, flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  writeText: { color: colors.white, fontWeight: '800' },
  error: { color: colors.danger },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, gap: 6, padding: spacing.lg },
  big: { color: colors.text, fontSize: 20, fontWeight: '900' },
  heading: { color: colors.primaryStrong, fontSize: 17, fontWeight: '900', marginTop: spacing.sm },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  rowTitle: { color: colors.text, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 13 },
  flex: { flex: 1 },
});
