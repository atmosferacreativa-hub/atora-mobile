import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

type Props = { title: string; description: string };

export function ComingSoonScreen({ title, description }: Props) {
  return (
    <View style={styles.page}>
      <Text style={styles.eyebrow}>PRÓXIMAMENTE</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.paper, flex: 1, justifyContent: 'center', padding: spacing.xl },
  eyebrow: { color: colors.mustard, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.navy, fontSize: 26, fontWeight: '800', marginTop: spacing.sm, textAlign: 'center' },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, textAlign: 'center' },
});
