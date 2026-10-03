import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../components/ui';
import { colors } from '../theme';

type Props = { title: string; description: string };

export function ComingSoonScreen({ title, description }: Props) {
  return (
    <View style={styles.page}>
      <EmptyState description={description} eyebrow="PRÓXIMAMENTE" icon="time-outline" title={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.background, flex: 1 },
});
