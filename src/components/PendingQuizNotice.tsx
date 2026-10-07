import { Pressable, StyleSheet, Text, View } from 'react-native';
import { remainingLabel, type PendingQuiz } from '../offline/quizDrafts';
import { colors, spacing } from '../theme';
import { t } from '../i18n';

/** Aviso de evaluación sin entregar (0.5.2). La entrega sigue siendo manual. */
export function PendingQuizNotice({ item, onOpen }: { item: PendingQuiz; onOpen: () => void }) {
  const time = remainingLabel(item.remainingSeconds);
  const late = item.remainingSeconds === 0;
  return (
    <View accessibilityRole="alert" style={[styles.box, late && styles.late]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('Tienes una evaluación sin entregar')}</Text>
        <Text style={styles.meta}>
          {t('{answered} de {total} respondidas', { answered: item.answered, total: item.total })}{time ? ` · ${time}` : ''}
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.button}>
        <Text style={styles.buttonText}>{t('Retomar')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.mustard, borderLeftWidth: 4, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  late: { borderColor: colors.red },
  copy: { flex: 1, gap: 2 },
  title: { color: colors.navy, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  button: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  buttonText: { color: colors.white, fontWeight: '900' },
});
