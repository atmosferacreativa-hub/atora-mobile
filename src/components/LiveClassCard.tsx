import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { locale, t } from '../i18n';
import { countdown, formatLocalStart, liveState, needsJoinUrl, phoneTimeZone } from '../live/liveClass';
import { colors, radius, spacing } from '../theme';
import type { LiveInfo } from '../types';

/**
 * 1.2.0 (plugin 6.39.0): clase en vivo de la lección. Integración con Zoom, Meet o Teams: «Unirse» abre la app del
 * proveedor o el navegador. El botón aparece solo con la clase abierta; luego, la grabación si el docente la publicó.
 */
export function LiveClassCard({ info, onRefresh }: { info: LiveInfo; onRefresh?: () => Promise<LiveInfo | null> }) {
  const [live, setLive] = useState<LiveInfo>(info);
  const [now, setNow] = useState(() => Date.now());
  const asked = useRef(false);

  useEffect(() => setLive(info), [info]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!onRefresh || asked.current || !needsJoinUrl(live, now)) return;
    asked.current = true;
    void onRefresh().then((next) => { if (next) setLive(next); }).catch(() => undefined);
  }, [live, now, onRefresh]);

  const state = live.status === 'unscheduled' ? 'unscheduled' : liveState(live, now);
  const zone = phoneTimeZone();
  const start = formatLocalStart(live.starts_at, locale(), zone || undefined);
  const left = countdown(live, now);
  const open = (url: string) => {
    void Linking.openURL(url).catch(() => Alert.alert(t('No se pudo abrir el enlace')));
  };

  return (
    // Sin accessibilityLabel en el contenedor: en Android reemplaza el texto de los hijos.
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{t('Clase en vivo · {provider}', { provider: live.provider_label })}</Text>
      {start ? <Text style={styles.when}>{zone ? `${start} (${zone})` : start}</Text> : null}
      {state === 'scheduled' && left ? (
        <Text style={styles.meta}>
          {left.days > 0
            ? t('Empieza en {days} d {hours} h', { days: left.days, hours: left.hours })
            : left.hours > 0
              ? t('Empieza en {hours} h {minutes} min', { hours: left.hours, minutes: left.minutes })
              : t('Empieza en {minutes} min', { minutes: left.minutes })}
        </Text>
      ) : null}
      {live.notes ? <Text style={styles.meta}>{live.notes}</Text> : null}

      {live.join_url && state !== 'ended' ? (
        <Pressable accessibilityRole="button" onPress={() => open(live.join_url)} style={styles.join}>
          <Text style={styles.joinText}>{live.is_host ? t('Iniciar la clase (anfitrión)') : t('Unirse a la clase')}</Text>
        </Pressable>
      ) : state === 'scheduled' ? (
        <Text style={styles.meta}>{t('El botón para unirte aparece 10 minutos antes de empezar.')}</Text>
      ) : state === 'ended' && !live.recording ? (
        <Text style={styles.meta}>
          {live.recording_mode === 'none' ? t('La clase terminó. Esta clase no se grabó.') : t('La clase terminó. La grabación se publicará aquí.')}
        </Text>
      ) : null}

      {live.recording ? (
        <View style={styles.recording}>
          <Pressable accessibilityRole="button" onPress={() => open(live.recording!.url)} style={styles.secondary}>
            <Text style={styles.secondaryText}>{t('Ver la grabación')}</Text>
          </Pressable>
          {live.recording.note ? <Text style={styles.meta}>{live.recording.note}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, marginTop: spacing.md },
  eyebrow: { color: colors.primaryStrong, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  when: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  join: { backgroundColor: colors.primary, borderRadius: radius.sm, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, marginTop: spacing.xs },
  joinText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  recording: { gap: spacing.xs, marginTop: spacing.xs },
  secondary: { borderColor: colors.primary, borderWidth: 1, borderRadius: radius.sm, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  secondaryText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
