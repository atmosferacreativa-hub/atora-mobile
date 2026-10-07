import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { riskA11y, riskBadge } from '../teacher/risk';
import type { Risk } from '../teacher/types';
import { colors, spacing } from '../theme';

const TONE = {
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  warning: { fg: colors.accentText, bg: colors.accentSoft },
  ok: { fg: '#17724A', bg: colors.successSoft },
} as const;

/** Riesgo del estudiante: ícono, color **y** texto con el motivo (nunca solo color). */
export function RiskBadge({ risk, compact }: { risk: Risk | null | undefined; compact?: boolean }) {
  const badge = riskBadge(risk);
  const tone = TONE[badge.tone];
  return (
    <View accessible accessibilityLabel={riskA11y(risk)} style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Ionicons name={badge.icon} size={14} color={tone.fg} />
      <Text style={[styles.text, { color: tone.fg }]}>{badge.text}</Text>
      {!compact && badge.detail ? <Text style={[styles.detail, { color: tone.fg }]} numberOfLines={2}>{badge.detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  text: { fontSize: 12, fontWeight: '900' },
  detail: { fontSize: 12, fontWeight: '600' },
});
