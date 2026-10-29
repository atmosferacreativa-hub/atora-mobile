import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchPlans } from '../../api/teacherPlans';
import { colors, radius, spacing } from '../../theme';
import type { Plan } from '../../teacher/plans';
import { t } from '../../i18n';

type Props = {
  token: string;
  courseId: number;
  title: string;
  onBack: () => void;
  onOpenPlan: (planId: number) => void;
};

/** 1.3.0: planificaciones híbridas del curso (borradores y publicadas) y «Nueva semana». */
export function TeacherPlansScreen({ token, courseId, title, onBack, onOpenPlan }: Props) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [canPublish, setCanPublish] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPlans(token, courseId);
      setPlans(result.plans);
      setCanPublish(result.can_publish);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t('No pudimos cargar las planificaciones. Conéctate para sincronizar.'));
    } finally {
      setLoading(false);
    }
  }, [token, courseId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Volver')} onPress={onBack} hitSlop={12} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryStrong} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('Planificación híbrida')}</Text>
          <Text style={styles.meta} numberOfLines={1}>{title}</Text>
        </View>
      </View>
      {!canPublish ? <Text style={styles.note}>{t('Puedes preparar planificaciones; el docente del curso las publica.')}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => onOpenPlan(0)} style={styles.primary} testID="plan-new">
        <Ionicons name="add" size={20} color={colors.white} />
        <Text style={styles.primaryText}>{t('Nueva semana')}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!plans && !error ? <ActivityIndicator color={colors.primary} /> : null}
      {plans && !plans.length ? <Text style={styles.meta}>{t('Todavía no hay planificaciones en este curso.')}</Text> : null}
      {(plans ?? []).map((plan) => (
        <Pressable key={plan.id} accessibilityRole="button" onPress={() => onOpenPlan(plan.id)} style={styles.card}>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{plan.title || t('Sin título')}</Text>
            <Text style={styles.meta}>
              {plan.status === 'published'
                ? plan.has_unpublished_changes
                  ? t('Publicada · con cambios sin publicar')
                  : t('Publicada')
                : t('Borrador')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  headerText: { flex: 1 },
  back: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 13 },
  note: { backgroundColor: colors.accentSoft, borderRadius: radius.md, color: colors.accentText, padding: spacing.sm },
  error: { color: colors.danger },
  primary: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 48 },
  primaryText: { color: colors.white, fontWeight: '900' },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 56, padding: spacing.md },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
