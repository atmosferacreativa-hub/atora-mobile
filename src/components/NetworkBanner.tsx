import { StyleSheet, Text, View } from 'react-native';
import { useNetworkState } from '../hooks/useNetworkState';
import { colors, spacing } from '../theme';

export function NetworkBanner() {
  const { offline } = useNetworkState();
  if (!offline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title}>Sin conexión</Text>
      <Text style={styles.text}>Tu progreso se guardará y se sincronizará cuando vuelvas a estar en línea.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.navy, borderBottomColor: colors.mustard, borderBottomWidth: 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  title: { color: colors.mustard, fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  text: { color: colors.white, fontSize: 12, marginTop: 2 },
});
