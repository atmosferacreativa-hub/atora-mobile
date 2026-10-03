import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors, radius, spacing, type } from '../../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', busy, disabled, style, accessibilityLabel }: ButtonProps) {
  const off = Boolean(disabled || busy);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(busy), disabled: off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], off && styles.disabled, pressed && styles.pressed, style]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.white} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryText]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({ title, subtitle, leading, onPress, style }: ListRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
    >
      {leading}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Ionicons color={colors.primary} name="chevron-forward" size={20} /> : null}
    </Pressable>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

export function EmptyState({ icon = 'sparkles-outline', eyebrow, title, description }: { icon?: IconName; eyebrow?: string; title: string; description?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons color={colors.primary} name={icon} size={28} />
      </View>
      {eyebrow ? <Text style={type.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyText}>{description}</Text> : null}
    </View>
  );
}

export function OfflineNotice({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.offline}>
      <Ionicons color={colors.accentText} name="cloud-offline-outline" size={18} />
      <View style={styles.offlineText}>
        <Text style={styles.offlineTitle}>Sin conexión</Text>
        <Text style={styles.offlineBody}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: radius.md, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1 },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondaryText: { color: colors.primary },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  empty: { alignItems: 'center', flex: 1, gap: spacing.sm, justifyContent: 'center', padding: spacing.xl },
  emptyIcon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.pill, height: 64, justifyContent: 'center', marginBottom: spacing.xs, width: 64 },
  emptyTitle: { color: colors.primaryStrong, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  offline: { alignItems: 'center', backgroundColor: colors.accentSoft, borderBottomColor: colors.accent, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  offlineText: { flex: 1 },
  offlineTitle: { color: colors.accentText, fontSize: 12, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  offlineBody: { color: colors.text, fontSize: 12, marginTop: 2 },
});
