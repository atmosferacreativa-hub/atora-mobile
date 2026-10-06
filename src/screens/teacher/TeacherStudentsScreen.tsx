import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchCourseStudents } from '../../api/teacher';
import { RiskBadge } from '../../components/RiskBadge';
import { colors, radius, spacing } from '../../theme';
import type { StudentRow } from '../../teacher/types';

type Props = {
  token: string;
  courseId: number;
  title: string;
  onBack: () => void;
  onOpenStudent: (student: StudentRow) => void;
  onAnnounce: () => void;
};

/** Estudiantes de un curso (0.7.0): avance, nota, último acceso y riesgo con su motivo; búsqueda por nombre. */
export function TeacherStudentsScreen({ token, courseId, title, onBack, onOpenStudent, onAnnounce }: Props) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<StudentRow[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (page: number, search: string) => {
    setLoading(true);
    try {
      const result = await fetchCourseStudents(token, courseId, page, search);
      setItems((current) => (page === 1 ? result.data.items : [...current, ...result.data.items]));
      setNext(result.data.next_page);
      setFromCache(result.fromCache);
      setError('');
    } catch {
      setError(search ? 'La búsqueda necesita conexión.' : 'No pudimos cargar los estudiantes. Conéctate para sincronizar.');
    } finally {
      setLoading(false);
    }
  }, [token, courseId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(1, query.trim()), query ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryStrong} />
        </Pressable>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onAnnounce} style={styles.announce} testID="teacher-announce">
        <Ionicons name="megaphone-outline" size={18} color={colors.white} />
        <Text style={styles.announceText}>Aviso al grupo</Text>
      </Pressable>
      <TextInput
        accessibilityLabel="Buscar estudiante por nombre"
        autoCorrect={false}
        onChangeText={setQuery}
        placeholder="Buscar por nombre"
        style={styles.search}
        testID="teacher-student-search"
        value={query}
      />
      {fromCache ? <Text style={styles.sync}>Sin conexión · lo último sincronizado</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => String(item.id)}
        onEndReached={() => { if (next && !loading) void load(next, query.trim()); }}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.empty}>Sin estudiantes{query ? ' con ese nombre' : ''}.</Text>}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => onOpenStudent(item)} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                Avance {item.progress}% · {item.final_grade === null ? 'Sin calificaciones' : `Nota ${item.final_grade}`}
                {item.last_access ? ` · Último acceso ${new Date(item.last_access).toLocaleDateString('es')}` : ''}
              </Text>
              <RiskBadge risk={item.risk} />
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  title: { color: colors.text, flex: 1, fontSize: 22, fontWeight: '900' },
  announce: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radius.md, flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  announceText: { color: colors.white, fontWeight: '800' },
  search: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, fontSize: 16, padding: spacing.md },
  sync: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.danger },
  empty: { color: colors.textMuted },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  rowText: { flex: 1, gap: 4 },
  name: { color: colors.text, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 12 },
});
