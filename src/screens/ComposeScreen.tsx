import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchRecipients } from '../api/messages';
import { EmptyState } from '../components/ui';
import { colors, radius, spacing } from '../theme';
import type { MessageRecipient } from '../types';
import { t } from '../i18n';

type Props = {
  token: string;
  onBack: () => void;
  onPick: (recipient: { id: number; name: string; courseId?: number }) => void;
};

/** Escribir a un docente (0.6.0): solo los docentes de los cursos del estudiante. */
export function ComposeScreen({ token, onBack, onPick }: Props) {
  const [items, setItems] = useState<MessageRecipient[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecipients(token).then(setItems).catch(() => {
      setItems([]);
      setError(t('Necesitas conexión para empezar una conversación.'));
    });
  }, [token]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>{t('← Mensajes')}</Text></Pressable>
      <Text style={styles.title}>{t('Escribir a un docente')}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!items ? <ActivityIndicator color={colors.primary} /> : null}
      {items?.map((teacher) => (
        <View key={teacher.id} style={styles.card}>
          <Text style={styles.name}>{teacher.name}</Text>
          {teacher.courses.map((course) => (
            <Pressable key={course.id} accessibilityRole="button" onPress={() => onPick({ id: teacher.id, name: teacher.name, courseId: course.id })} style={styles.course}>
              <Ionicons name="book-outline" size={16} color={colors.primary} />
              <Text style={styles.courseText}>{course.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ))}
      {items && !items.length && !error ? <EmptyState icon="people-outline" title={t('Sin docentes')} description={t('Cuando estés matriculado en un curso, aquí aparecerán sus docentes.')} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  back: { color: colors.primary, fontWeight: '800' },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  error: { color: colors.danger },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  name: { color: colors.text, fontSize: 16, fontWeight: '900' },
  course: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  courseText: { color: colors.text, flex: 1 },
});
