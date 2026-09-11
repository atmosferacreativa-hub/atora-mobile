import { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SectionButton } from './src/components/SectionButton';
import { HomeScreen } from './src/screens/HomeScreen';
import { colors, spacing } from './src/theme';
import type { AppSection } from './src/types';

const labels: Record<AppSection, string> = {
  home: 'Inicio',
  courses: 'Cursos',
  grades: 'Notas',
  profile: 'Perfil',
};

export default function App() {
  const [section, setSection] = useState<AppSection>('home');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <View style={styles.header}>
        <Text style={styles.brand}>ATORA</Text>
        <Text style={styles.product}>Aprendizaje móvil</Text>
      </View>

      <View style={styles.main}>
        {section === 'home' ? (
          <HomeScreen />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>{labels[section]}</Text>
            <Text style={styles.placeholderText}>Esta sección se conectará con la API móvil de ATORA.</Text>
          </View>
        )}
      </View>

      <View style={styles.navigation}>
        {(Object.keys(labels) as AppSection[]).map((item) => (
          <SectionButton
            key={item}
            label={labels[item]}
            section={item}
            active={section === item}
            onPress={setSection}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy, flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  brand: { color: colors.white, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  product: { color: colors.mustard, fontSize: 12, fontWeight: '700' },
  main: { backgroundColor: colors.paper, flex: 1 },
  navigation: { backgroundColor: colors.white, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row' },
  placeholder: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  placeholderTitle: { color: colors.navy, fontSize: 28, fontWeight: '800' },
  placeholderText: { color: colors.muted, fontSize: 16, marginTop: spacing.sm, textAlign: 'center' },
});
