import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { enablePush, fetchPreferences, permissionStatus, pushSupported, savePreferences } from '../api/push';
import { colors, radius, spacing } from '../theme';
import type { NotificationPreferences } from '../types';
import { t, tk } from '../i18n';

const LABELS: { key: keyof NotificationPreferences; label: string; help: string }[] = [
  { key: 'messages', label: tk('Mensajes'), help: tk('Cuando un docente te escribe.') },
  { key: 'grades', label: tk('Notas'), help: tk('Cuando se publica una nota.') },
  { key: 'deadlines', label: tk('Fechas límite'), help: tk('Un día antes de que venza una entrega.') },
  { key: 'notices', label: tk('Avisos'), help: tk('Lecciones nuevas, matrículas y otros avisos.') },
];

/**
 * Explicación previa (0.6.0): el permiso del sistema se pide solo al tocar
 * "Activar", después de leer para qué sirve. Nunca al abrir la app.
 */
export function PushPrompt({ token, compact }: { token: string; compact?: boolean }) {
  const [state, setState] = useState<'hidden' | 'ask' | 'denied'>('hidden');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!(await pushSupported())) return;
      const status = await permissionStatus();
      setState(status === 'undetermined' ? 'ask' : status === 'denied' && !compact ? 'denied' : 'hidden');
    })();
  }, [compact]);

  if (state === 'hidden') return null;

  const activate = async () => {
    setBusy(true);
    const result = await enablePush(token).catch(() => 'denied' as const);
    setBusy(false);
    setState(result === 'enabled' ? 'hidden' : 'denied');
  };

  return (
    <View style={styles.prompt}>
      <Ionicons name="notifications-outline" size={22} color={colors.accentText} />
      <View style={styles.flex}>
        <Text style={styles.promptTitle}>{state === 'denied' ? t('Avisos desactivados en el teléfono') : t('Recibe avisos en el teléfono')}</Text>
        <Text style={styles.promptText}>
          {state === 'denied'
            ? t('Puedes activarlos en los ajustes del sistema. Mientras tanto, la app se actualiza al abrirla.')
            : t('Te avisamos de mensajes, notas y fechas límite. El aviso no muestra el contenido; lo ves al abrir la app.')}
        </Text>
        {state === 'denied' ? (
          <Pressable hitSlop={12} accessibilityRole="button" onPress={() => void Linking.openSettings()}><Text style={styles.link}>{t('Abrir ajustes')}</Text></Pressable>
        ) : (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void activate()} style={styles.activate}>
            <Text style={styles.activateText}>{busy ? t('Activando…') : t('Activar')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Preferencias por tipo (guardadas en el servidor). */
export function PushPreferences({ token }: { token: string }) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setPrefs(await fetchPreferences(token));
      setError('');
    } catch {
      setError(t('Conéctate para cambiar qué avisos recibes.'));
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
    try {
      setPrefs(await savePreferences(token, { [key]: value }));
    } catch {
      setPrefs(prefs);
      setError(t('No se pudo guardar. Inténtalo con conexión.'));
    }
  };

  return (
    <View style={styles.prefs}>
      <PushPrompt token={token} />
      {error ? <Text style={styles.promptText}>{error}</Text> : null}
      {prefs ? LABELS.map((item) => (
        <View key={item.key} style={styles.prefRow}>
          <View style={styles.flex}>
            <Text style={styles.prefLabel}>{t(item.label)}</Text>
            <Text style={styles.promptText}>{t(item.help)}</Text>
          </View>
          <Switch accessibilityLabel={t(item.label)} value={prefs[item.key]} onValueChange={(value) => void toggle(item.key, value)} />
        </View>
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  prompt: { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  promptTitle: { color: colors.text, fontWeight: '900' },
  promptText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  activate: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radius.pill, marginTop: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: 6 },
  activateText: { color: colors.white, fontWeight: '800' },
  link: { color: colors.primary, fontWeight: '800', marginTop: spacing.xs },
  prefs: { gap: spacing.sm },
  prefRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  prefLabel: { color: colors.text, fontWeight: '800' },
});
