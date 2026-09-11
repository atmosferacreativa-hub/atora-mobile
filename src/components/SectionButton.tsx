import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';
import type { AppSection } from '../types';

type Props = {
  label: string;
  section: AppSection;
  active: boolean;
  onPress: (section: AppSection) => void;
};

export function SectionButton({ label, section, active, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => onPress(section)}
      style={[styles.button, active && styles.active]}
    >
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  active: { borderTopColor: colors.mustard, borderTopWidth: 3 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  activeLabel: { color: colors.navy },
});
