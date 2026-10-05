import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchAgenda } from '../api/agenda';
import { addDays, groupByDay, localDay, rangeFor, type AgendaView } from '../agenda/agenda';
import { colors, radius, spacing } from '../theme';
import type { AgendaItem, InternalLink } from '../types';

type Props = { token: string; onOpenLink: (link: InternalLink) => void };

const LABELS: Record<AgendaItem['type'], { text: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  assignment_due: { text: 'Entrega', icon: 'document-text-outline' },
  quiz_due: { text: 'Evaluación', icon: 'help-circle-outline' },
  live_class: { text: 'Clase en vivo', icon: 'videocam-outline' },
  event: { text: 'Evento', icon: 'calendar-outline' },
};

function dayTitle(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const today = localDay(new Date());
  if (day === today) return 'Hoy';
  if (day === addDays(today, 1)) return 'Mañana';
  return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Agenda (0.6.0): vista por día y por semana; sin conexión, lo último sincronizado con su fecha. */
export function AgendaScreen({ token, onOpenLink }: Props) {
  const [view, setView] = useState<AgendaView>('week');
  const [day, setDay] = useState(localDay(new Date()));
  const [items, setItems] = useState<AgendaItem[] | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const range = rangeFor(view, day);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAgenda(range.from, range.to, token);
      setItems(result.data.items);
      setSyncedAt(result.data.syncedAt);
      setFromCache(result.fromCache);
      setError('');
    } catch {
      setItems([]);
      setError('Sin conexión y sin una agenda guardada para estas fechas.');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, token]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const step = (direction: number) => setDay((current) => addDays(current, direction * (view === 'week' ? 7 : 1)));
  const days = groupByDay(items ?? [], range.from, range.to);

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Text style={styles.title}>Agenda</Text>
      <View style={styles.toolbar}>
        <View style={styles.segment}>
          {(['day', 'week'] as AgendaView[]).map((option) => (
            <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: view === option }} onPress={() => setView(option)} style={[styles.segmentItem, view === option && styles.segmentActive]}>
              <Text style={[styles.segmentText, view === option && styles.segmentTextActive]}>{option === 'day' ? 'Día' : 'Semana'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Anterior" onPress={() => step(-1)} hitSlop={10}><Ionicons name="chevron-back" size={22} color={colors.primary} /></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setDay(localDay(new Date()))}><Text style={styles.todayLink}>Hoy</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Siguiente" onPress={() => step(1)} hitSlop={10}><Ionicons name="chevron-forward" size={22} color={colors.primary} /></Pressable>
        </View>
      </View>
      {fromCache && syncedAt ? <Text style={styles.sync}>Sin conexión · actualizado el {new Date(syncedAt).toLocaleString('es')}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!items ? <ActivityIndicator color={colors.primary} /> : null}
      {items ? days.map((entry) => (
        <View key={entry.day} style={styles.day}>
          <Text style={styles.dayTitle}>{dayTitle(entry.day)}</Text>
          {!entry.items.length ? <Text style={styles.free}>Sin actividades.</Text> : entry.items.map((item, index) => {
            const label = LABELS[item.type];
            return (
              <Pressable
                key={`${item.type}-${item.title}-${index}`}
                accessibilityRole={item.link ? 'button' : undefined}
                disabled={!item.link}
                onPress={() => item.link && onOpenLink(item.link)}
                style={[styles.item, item.done && styles.itemDone]}
              >
                <Text style={styles.time}>{new Date(item.starts_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</Text>
                <Ionicons name={label.icon} size={20} color={colors.primary} />
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemMeta}>{label.text}{item.course ? ` · ${item.course.title}` : ''}{item.done ? ' · Entregado' : ''}</Text>
                </View>
                {item.link ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
              </Pressable>
            );
          })}
        </View>
      )) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  toolbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  segment: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, flexDirection: 'row', padding: 3 },
  segmentItem: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.text, fontWeight: '700' },
  segmentTextActive: { color: colors.white },
  nav: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  todayLink: { color: colors.primary, fontWeight: '800' },
  sync: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.danger },
  day: { gap: spacing.xs },
  dayTitle: { color: colors.primaryStrong, fontSize: 15, fontWeight: '900', textTransform: 'capitalize' },
  free: { color: colors.textMuted, fontSize: 13 },
  item: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  itemDone: { opacity: 0.6 },
  time: { color: colors.text, fontVariant: ['tabular-nums'], fontWeight: '800', width: 48 },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { color: colors.text, fontWeight: '800' },
  itemMeta: { color: colors.textMuted, fontSize: 12 },
});
