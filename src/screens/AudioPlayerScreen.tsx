import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { resumePosition, savePosition } from '../api/positions';
import { audioMetaLine, clampSeek, compatibilityNote, formatDuration, formatRate, nextRate, startPosition } from '../audio/audioMeta';
import { useNetworkState } from '../hooks/useNetworkState';
import { colors, spacing } from '../theme';
import { t } from '../i18n';
import type { LessonResource } from '../types';

type Props = {
  lessonId: number;
  resource: LessonResource;
  /** Archivo descargado (sin conexión); si falta, se escucha en línea. */
  localUri?: string;
  localBytes?: number | null;
  onBack: () => void;
};

const SAVE_EVERY_MS = 10_000;

/**
 * 1.2.0: audio de la lección. Pausa, ±15 s, velocidad, barra para saltar, posición sincronizada
 * con la cola de posiciones (clave `position_key`), transcripción. Sin conexión solo si está descargado.
 */
export function AudioPlayerScreen({ lessonId, resource, localUri, localBytes, onBack }: Props) {
  const network = useNetworkState();
  const remote = resource.download_url || resource.url;
  const source = localUri || remote;
  const player = useAudioPlayer(source ? { uri: source } : null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [rate, setRate] = useState(1);
  const [barWidth, setBarWidth] = useState(0);
  const [resumed, setResumed] = useState(false);
  const lastSaved = useRef(0);
  const positionKey = resource.position_key || '';
  const duration = status.duration && status.duration > 0 ? status.duration : resource.duration_seconds ?? 0;
  const note = compatibilityNote(resource, Platform.OS);
  const blockedOffline = !localUri && network.offline;

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  // Reanudar desde la posición guardada (la pendiente de enviar o la del servidor).
  useEffect(() => {
    if (resumed || !status.isLoaded) return;
    let active = true;
    void (async () => {
      const saved = positionKey ? await resumePosition(lessonId, resource.resume_position_seconds, positionKey, false).catch(() => 0) : 0;
      const target = startPosition(saved, duration);
      if (active && target > 0) await player.seekTo(target).catch(() => undefined);
      if (active) setResumed(true);
    })();
    return () => { active = false; };
  }, [status.isLoaded, resumed, positionKey, lessonId, resource.resume_position_seconds, duration, player]);

  const persist = useCallback((force = false) => {
    if (!positionKey || !resumed) return;
    const now = Date.now();
    if (!force && now - lastSaved.current < SAVE_EVERY_MS) return;
    lastSaved.current = now;
    void savePosition(lessonId, player.currentTime, duration, positionKey).catch(() => undefined);
  }, [positionKey, resumed, lessonId, player, duration]);

  useEffect(() => {
    if (status.playing) persist(false);
  }, [status.currentTime, status.playing, persist]);

  useEffect(() => () => {
    if (positionKey) void savePosition(lessonId, player.currentTime, duration, positionKey).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      persist(true);
    } else {
      if (duration > 0 && status.currentTime >= duration - 0.5) void player.seekTo(0);
      player.play();
    }
  };

  const skip = (delta: number) => {
    void player.seekTo(clampSeek(player.currentTime, delta, duration)).then(() => persist(true));
  };

  const changeRate = () => {
    const next = nextRate(rate);
    setRate(next);
    player.setPlaybackRate(next);
  };

  const onBarLayout = (event: LayoutChangeEvent) => setBarWidth(event.nativeEvent.layout.width);
  const seekToX = (x: number) => {
    if (!barWidth || !duration) return;
    void player.seekTo(Math.max(0, Math.min(duration, (x / barWidth) * duration))).then(() => persist(true));
  };

  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const meta = audioMetaLine(resource, localBytes);

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>{t('← Volver')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t('AUDIO')}</Text>
        <Text style={styles.title}>{resource.title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        <Text style={styles.meta}>{localUri ? t('Disponible sin conexión') : t('Se escucha con conexión')}</Text>
        {note ? <Text style={styles.note} accessibilityRole="text">{note}</Text> : null}
        {resource.description ? <Text style={styles.description}>{resource.description}</Text> : null}

        {blockedOffline ? (
          <Text style={styles.offline}>{t('Sin conexión: descarga el audio para escucharlo sin conexión.')}</Text>
        ) : (
          <View style={styles.player}>
            <Pressable
              accessibilityRole="adjustable"
              accessibilityLabel={t('Posición del audio')}
              accessibilityValue={{ text: `${formatDuration(status.currentTime)} / ${formatDuration(duration)}` }}
              onLayout={onBarLayout}
              onPress={(event) => seekToX(event.nativeEvent.locationX)}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </Pressable>
            <Text testID="audio-time" style={styles.time}>{`${formatDuration(status.currentTime)} / ${formatDuration(duration)}`}</Text>
            <View style={styles.controls}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('Retroceder 15 segundos')} onPress={() => skip(-15)} style={styles.small}>
                <Text style={styles.smallText}>{t('−15 s')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={toggle} style={styles.main} disabled={!status.isLoaded}>
                <Text style={styles.mainText}>{status.isLoaded ? (status.playing ? t('Pausa') : t('Reproducir')) : t('Cargando...')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('Avanzar 15 segundos')} onPress={() => skip(15)} style={styles.small}>
                <Text style={styles.smallText}>{t('+15 s')}</Text>
              </Pressable>
            </View>
            {/* Sin accessibilityLabel: en Android reemplaza el texto visible ("Velocidad 1,25×") y se pierde la velocidad actual. */}
            <Pressable accessibilityRole="button" onPress={changeRate} style={styles.rate}>
              <Text style={styles.rateText}>{t('Velocidad {rate}', { rate: formatRate(rate) })}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('Transcripción')}</Text>
        <Text style={styles.transcript}>{resource.transcript?.trim() ? resource.transcript : t('El docente no agregó transcripción.')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  eyebrow: { color: colors.accentText, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  title: { color: colors.text, fontWeight: '800', fontSize: 22 },
  meta: { color: colors.textMuted, fontSize: 14 },
  note: { color: colors.accentText, backgroundColor: colors.accentSoft, padding: spacing.sm, borderRadius: 8 },
  description: { color: colors.text, fontSize: 15, lineHeight: 22 },
  offline: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.sm, borderRadius: 8 },
  player: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.line },
  track: { height: 44, justifyContent: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 22, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary },
  time: { color: colors.text, fontVariant: ['tabular-nums'], textAlign: 'center', fontSize: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  small: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  smallText: { color: colors.primary, fontWeight: '700' },
  main: { minWidth: 120, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.primary },
  mainText: { color: colors.surface, fontWeight: '800', fontSize: 16 },
  rate: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  rateText: { color: colors.primary, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 16, marginTop: spacing.md },
  transcript: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
