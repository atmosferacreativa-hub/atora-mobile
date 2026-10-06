import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchQueue } from '../../api/teacher';
import { colors, radius, spacing } from '../../theme';
import type { QueueItem } from '../../teacher/types';

type Props = {
  token: string;
  /** 0.8.0: abrir la entrega para calificarla. Sin esto, la cola es solo lectura (0.7.0). */
  onOpen?: (item: QueueItem) => void;
  onCount?: (count: number) => void;
};

const FILTERS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Por calificar' },
  { key: 'draft', label: 'En borrador' },
  { key: 'late', label: 'Tardías' },
  { key: 'graded', label: 'Calificadas' },
];

/** Cola de entregas, de la más antigua a la más nueva. */
export function GradingQueueScreen({ token, onOpen, onCount }: Props) {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (next: string | null) => {
    setLoading(true);
    try {
      const page = await fetchQueue(token, { status, cursor: next });
      setItems((current) => (next ? [...current, ...page.items] : page.items));
      setTotal(page.total);
      setCursor(page.next_cursor);
      if (status === 'pending') onCount?.(page.total);
      setError('');
    } catch {
      setError('La cola necesita conexión.');
    } finally {
      setLoading(false);
    }
  }, [token, status, onCount]);

  useFocusEffect(useCallback(() => { void load(null); }, [load]));

  return (
    <View style={styles.page}>
      <Text style={styles.eyebrow}>CALIFICAR</Text>
      <View style={styles.chips}>
        {FILTERS.map((filter) => (
          <Pressable key={filter.key} accessibilityRole="button" onPress={() => setStatus(filter.key)} style={[styles.chip, status === filter.key && styles.chipOn]}>
            <Text style={[styles.chipText, status === filter.key && styles.chipTextOn]}>{filter.label}</Text>
          </Pressable>
        ))}
      </View>
      {!onOpen ? <Text style={styles.note}>Por ahora la cola es de consulta: califica desde la web.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.count}>{total === 1 ? '1 entrega' : `${total} entregas`}</Text>
      <FlatList
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => String(item.id)}
        onEndReached={() => { if (cursor && !loading) void load(cursor); }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(null)} />}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.note}>Nada en esta lista.</Text>}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" disabled={!onOpen} onPress={() => onOpen?.(item)} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.student.name}{item.group ? ' · Grupal' : ''}</Text>
              <Text style={styles.rowMeta}>{item.lesson.title} · {item.course.title}</Text>
              <Text style={[styles.rowMeta, item.is_late && styles.late]}>
                {item.submitted_at ? new Date(item.submitted_at).toLocaleString('es') : ''}{item.is_late ? ' · Tardía' : ''}
              </Text>
            </View>
            {onOpen ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderColor: colors.line, borderRadius: 16, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextOn: { color: colors.white },
  note: { color: colors.textMuted },
  error: { color: colors.danger },
  count: { color: colors.text, fontWeight: '800' },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontWeight: '800' },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  late: { color: colors.danger },
});
