import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { PRIVACY_URL, SUPPORT_URL } from '../legal';
import { colors, spacing } from '../theme';

/** Ordinary scroll content: no fixed overlay or interference with the keyboard. */
export function LegalLinks() {
  const open = (url: string) => {
    void Linking.openURL(url).catch(() => Alert.alert(t('No se pudo abrir el enlace'), t('Inténtalo otra vez.')));
  };
  return (
    <View style={styles.links}>
      <Pressable accessibilityRole="link" onPress={() => open(PRIVACY_URL)} style={styles.link} testID="privacy-link">
        <Text style={styles.text}>{t('Política de privacidad')}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => open(SUPPORT_URL)} style={styles.link} testID="support-link">
        <Text style={styles.text}>{t('Soporte')}</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  text: { color: colors.primary, fontSize: 14, textDecorationLine: 'underline' },
});
