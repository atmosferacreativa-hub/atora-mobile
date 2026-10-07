import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { completeLesson, fetchLesson } from '../api/courses';
import { getServerCapabilities } from '../api/discovery';
import { formatClock, resumePosition, savePosition } from '../api/positions';
import { MediaImage } from '../components/MediaImage';
import { ensureLocalThumbnail, getLocalThumbnail, needsLocalThumbnail } from '../offline/videoThumbnails';
import {
  downloadLessonMedia,
  downloadResource,
  findLessonDownload,
  findVideoDownload,
  removeVideoDownload,
  listResourceDownloads,
  reconcileLessonResources,
  removeDownloadFile,
  removeLessonDownload,
  type DownloadRecord,
} from '../offline/mediaDownloads';
import { formatBytes, resourceKey } from '../offline/downloadsMath';
import { flushOutbox } from '../offline/outbox/runtime';
import { useNetworkState } from '../hooks/useNetworkState';
import { perfMark, perfNow } from '../perf';
import { offlineMessage } from '../ai/conversation';
import { openWithSystem, viewerKind } from '../viewer/files';
import { colors, spacing } from '../theme';
import type { LessonDetail, LessonResource } from '../types';
import { t } from '../i18n';

export type OpenResourceParams = { title: string; localUri: string; kind: 'pdf' | 'image'; mime?: string };

type Props = {
  lessonId: number;
  token: string;
  onBack: () => void;
  onCompleted: () => void;
  onOpenQuiz: () => void;
  onOpenAssignment: () => void;
  onOpenResource: (params: OpenResourceParams) => void;
  /** 0.9.0: asistente de IA (solo si el servidor declara `ai_assistant`). */
  onAsk?: (title: string) => void;
};

/** Menos de esto no vale la pena ofrecer "Continuar desde". */
const MIN_RESUME_SECONDS = 5;
const POSITION_SAVE_MS = 10_000;
const NEAR_END_SECONDS = 5;

const RESOURCE_LABELS: Record<string, string> = {
  pdf: 'PDF', guia: 'Guía', presentacion: 'Presentación', audio: 'Audio', video: 'Video', link: 'Enlace', archivo: 'Archivo', file: 'Archivo',
};

/** Un video de la lección: el que el estudiante eligió (0.4.1) o el único (servidores anteriores). */
export type PlayableVideo = {
  /** `videos[].key`; ausente con servidores sin multi_video. */
  key?: string;
  index: number;
  title: string;
  url: string;
  embedUrl: string;
  provider: 'google_drive' | 'youtube' | 'vimeo' | 'direct' | '';
  thumbnail: string;
  /** undefined: el servidor no lo informa (anterior a 6.28.0). */
  downloadable?: boolean;
  bytes?: number | null;
};

function VideoBlock({
  video,
  mediaUri,
  downloaded,
  downloadBusy,
  onDownload,
  onRemoveDownload,
  resumeAt,
  onPosition,
  durationBadge,
}: {
  video: PlayableVideo;
  mediaUri: string;
  downloaded: boolean;
  downloadBusy: boolean;
  onDownload: () => void;
  onRemoveDownload: () => void;
  resumeAt: number;
  onPosition: (seconds: number, duration: number, final: boolean) => void;
  durationBadge?: string;
}) {
  // YouTube y Vimeo no se reproducen dentro de la app: se abren aparte (solo con conexión).
  const external = video.provider === 'youtube' || video.provider === 'vimeo';
  const player = useVideoPlayer(mediaUri || null, (instance) => {
    // El tiempo se sigue cada segundo para que pausar o salir guarde la posición exacta.
    instance.timeUpdateEventInterval = 1;
  });
  // La miniatura es la carátula hasta que el estudiante pulsa reproducir.
  const [started, setStarted] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const tracks = Boolean(mediaUri) && !video.embedUrl;
  const lastTime = useRef({ seconds: 0, duration: 0 });
  const lastSavedAt = useRef(0);
  useEffect(() => {
    if (!started || !mediaUri || video.embedUrl) return;
    if (startAt > 0) player.currentTime = startAt;
    player.play();
  }, [started, startAt, mediaUri, video.embedUrl, player]);
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!tracks || !started || currentTime <= 0) return;
    lastTime.current = { seconds: currentTime, duration: player.duration };
    // 0.4.0: a la cola, una marca cada 10 s (reemplaza la anterior); además al pausar y al salir.
    if (Date.now() - lastSavedAt.current >= POSITION_SAVE_MS) {
      lastSavedAt.current = Date.now();
      onPosition(currentTime, player.duration, false);
    }
  });
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (!tracks || !started || isPlaying || lastTime.current.seconds <= 0) return;
    onPosition(lastTime.current.seconds, lastTime.current.duration, true);
  });
  useEffect(() => () => {
    // Al salir de la lección: última posición conocida.
    if (lastTime.current.seconds > 0) onPosition(lastTime.current.seconds, lastTime.current.duration, true);
  }, [onPosition]);
  // La duración llega al cargar el video, antes de reproducir.
  const [videoDuration, setVideoDuration] = useState(0);
  useEventListener(player, 'sourceLoad', ({ duration }) => setVideoDuration(duration));
  const nearEnd = (seconds: number) => videoDuration > 0 && seconds >= videoDuration - NEAR_END_SECONDS;
  const offerResume = tracks && resumeAt >= MIN_RESUME_SECONDS && !nearEnd(resumeAt);
  const play = (from: number) => {
    // Visto hasta el final (o casi): se empieza de nuevo.
    setStartAt(nearEnd(from) ? 0 : from);
    setStarted(true);
  };
  const cover = (
    <>
      <Pressable hitSlop={12} accessibilityLabel={t('Reproducir video')} accessibilityRole="button" onPress={() => (external ? void Linking.openURL(video.url) : play(offerResume ? resumeAt : 0))}>
        <MediaImage play uri={video.thumbnail} badge={durationBadge} />
      </Pressable>
      {offerResume ? (
        <View style={styles.resumeRow}>
          <Pressable accessibilityRole="button" onPress={() => play(resumeAt)} style={[styles.resumeButton, styles.resumePrimary]}>
            <Text style={styles.resumePrimaryText}>{t('Continuar desde {time}', { time: formatClock(resumeAt) })}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => play(0)} style={styles.resumeButton}>
            <Text style={styles.resumeText}>{t('Empezar de nuevo')}</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  // Servidores anteriores a 6.28.0 no informan si el video se puede descargar: se mantiene el botón.
  const videoOnlineOnly = video.downloadable === false && !downloaded;

  return (
    <>
      {external ? (
        <>
          {cover}
          <Text style={styles.onlineOnly}>{t('Solo con conexión')} · {video.provider === 'vimeo' ? 'Vimeo' : 'YouTube'}</Text>
          <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(video.url)} style={styles.embedButton}>
            <Text style={styles.embedButtonText}>{t('Abrir video')}</Text>
          </Pressable>
        </>
      ) : (video.embedUrl || mediaUri) && !started ? (
        cover
      ) : video.embedUrl ? (
        <>
          <View style={styles.video}>
            <WebView
              allowsFullscreenVideo
              javaScriptEnabled
              mediaPlaybackRequiresUserAction={false}
              onLoadStart={() => { setEmbedLoading(true); setEmbedFailed(false); }}
              onLoadEnd={() => setEmbedLoading(false)}
              onError={() => { setEmbedLoading(false); setEmbedFailed(true); }}
              onShouldStartLoadWithRequest={({ url }) =>
                url === 'about:blank'
                || /^https:\/\/([a-z0-9-]+\.)*(google\.com|googleusercontent\.com|gstatic\.com|googlevideo\.com)\//i.test(url)
              }
              originWhitelist={['https://*']}
              source={{ uri: video.embedUrl }}
              style={styles.embed}
            />
            {embedLoading ? (
              <View style={styles.embedOverlay}>
                <ActivityIndicator color={colors.mustard} />
              </View>
            ) : null}
          </View>
          <Text style={styles.onlineOnly}>{t('Solo con conexión · Google Drive')}</Text>
          <View style={styles.embedActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openURL(video.embedUrl)}
              style={styles.embedButton}
            >
              <Text style={styles.embedButtonText}>{t('Abrir video en el navegador')}</Text>
            </Pressable>
            {embedFailed ? (
              <Text style={styles.embedHint}>{t('Si el video no carga aquí, el navegador suele funcionar mejor.')}</Text>
            ) : null}
          </View>
        </>
      ) : mediaUri ? (
        <>
          <VideoView
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
            player={player}
            style={styles.video}
          />
          {videoOnlineOnly ? (
            <Text style={styles.onlineOnly}>{t('Solo con conexión')}</Text>
          ) : (
            <>
              <Text style={styles.source}>
                {downloaded ? t('Disponible sin conexión') : `${t('Reproducción en línea')}${video.bytes ? ` · ${formatBytes(video.bytes)}` : ''}`}
              </Text>
              <Pressable
                disabled={downloadBusy}
                onPress={downloaded ? onRemoveDownload : onDownload}
                style={styles.downloadButton}
              >
                {downloadBusy ? <ActivityIndicator color={colors.blue} /> : (
                  <Text style={styles.downloadText}>
                    {downloaded ? t('Eliminar descarga') : t('Guardar para usar sin conexión')}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </>
      ) : (
        <View style={styles.mediaUnavailable}>
          <Text style={styles.mediaUnavailableText}>{t('Esta lección no tiene un video compatible configurado.')}</Text>
        </View>
      )}
    </>
  );
}

function LessonContent({
  lesson,
  videoArea,
  busy,
  onComplete,
  onOpenQuiz,
  showAssignment,
  onOpenAssignment,
  savedResources,
  resourceBusy,
  onResourcePress,
  onResourceDownload,
  onResourceRemove,
  onAsk,
  askOffline,
}: {
  lesson: LessonDetail;
  videoArea: ReactNode;
  busy: boolean;
  onComplete: () => void;
  onOpenQuiz: () => void;
  showAssignment: boolean;
  onOpenAssignment: () => void;
  savedResources: Record<string, DownloadRecord>;
  resourceBusy: string;
  onResourcePress: (resource: LessonResource) => void;
  onResourceDownload: (resource: LessonResource) => void;
  onResourceRemove: (record: DownloadRecord) => void;
  onAsk?: () => void;
  askOffline: boolean;
}) {
  const resources = Array.isArray(lesson.resources) ? lesson.resources : [];

  return (
    <>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.meta}>{t('{count} minutos', { count: lesson.duration_min })} · {lesson.type}</Text>
      {videoArea}
      <Text style={styles.body}>{lesson.content_text || t('Esta lección no contiene texto adicional.')}</Text>
      {resources.length ? (
        <View style={styles.resources}>
          <Text style={styles.sectionTitle}>{t('Materiales')}</Text>
          <Text style={styles.sectionHint}>{t('Guías, enlaces y archivos. Lo descargado se abre sin conexión.')}</Text>
          <View style={styles.resourceList}>
            {resources.map((resource, index) => {
              const key = resourceKey(lesson.id, resource);
              const saved = savedResources[key];
              const busyHere = resourceBusy === key;
              const size = formatBytes(saved?.size ?? resource.bytes);
              const status = saved
                ? saved.updateAvailable ? 'Actualización disponible' : 'Disponible sin conexión'
                : resource.downloadable ? 'Se puede descargar' : 'Solo con conexión';
              return (
                <View key={`${resource.url}-${index}`} style={styles.resourceCard}>
                  <Pressable accessibilityRole="button" onPress={() => onResourcePress(resource)} style={styles.resourceMeta}>
                    <Text style={styles.resourceType}>
                      {(RESOURCE_LABELS[resource.type] ?? resource.type ?? 'Recurso').toUpperCase()}{size ? ` · ${size}` : ''}
                    </Text>
                    <Text style={styles.resourceTitle}>{resource.title}</Text>
                    {resource.description ? (
                      <Text style={styles.resourceDescription} numberOfLines={4}>{resource.description}</Text>
                    ) : null}
                    <Text style={[styles.resourceStatus, saved && !saved.updateAvailable ? styles.resourceStatusOk : null]}>{status}</Text>
                  </Pressable>
                  <View style={styles.resourceActions}>
                    {busyHere ? <ActivityIndicator color={colors.blue} /> : saved ? (
                      <>
                        {saved.updateAvailable ? (
                          <Pressable hitSlop={12} accessibilityRole="button" onPress={() => onResourceDownload(resource)}>
                            <Text style={styles.resourceAction}>{t('Actualizar')}</Text>
                          </Pressable>
                        ) : null}
                        <Pressable hitSlop={12} accessibilityRole="button" onPress={() => onResourceRemove(saved)}>
                          <Text style={styles.resourceRemove}>{t('Eliminar')}</Text>
                        </Pressable>
                      </>
                    ) : resource.downloadable ? (
                      <Pressable hitSlop={12} accessibilityRole="button" onPress={() => onResourceDownload(resource)}>
                        <Text style={styles.resourceAction}>{t('Descargar')}</Text>
                      </Pressable>
                    ) : (
                      <Pressable hitSlop={12} accessibilityRole="button" onPress={() => onResourcePress(resource)}>
                        <Text style={styles.resourceAction}>{t('Abrir')}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {lesson.quiz_available ? (
        <View style={styles.quizCard}>
          <View style={styles.quizCopy}>
            <Text style={styles.quizEyebrow}>{t('EVALUACIÓN')}</Text>
            <Text style={styles.quizTitle}>{t('Comprueba lo aprendido')}</Text>
            <Text style={styles.quizHelp}>{t('Responde con calma en una interfaz clara, una pregunta a la vez.')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenQuiz} style={styles.quizButton}>
            <Text style={styles.quizButtonText}>{t('Comenzar evaluación')}</Text>
          </Pressable>
        </View>
      ) : null}
      {showAssignment ? (
        <View style={styles.quizCard}>
          <View style={styles.quizCopy}>
            <Text style={styles.quizEyebrow}>{t('TAREA')}</Text>
            <Text style={styles.quizTitle}>{t('Entrega tu trabajo')}</Text>
            <Text style={styles.quizHelp}>{t('Puedes prepararla sin conexión: se enviará sola cuando vuelvas a tenerla.')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenAssignment} style={styles.quizButton}>
            <Text style={styles.quizButtonText}>{t('Ver tarea')}</Text>
          </Pressable>
        </View>
      ) : null}
      {onAsk ? (
        <View style={styles.quizCard} testID="lesson-ask-card">
          <View style={styles.quizCopy}>
            <Text style={styles.quizEyebrow}>{t('ASISTENTE')}</Text>
            <Text style={styles.quizTitle}>{t('¿Te quedó una duda?')}</Text>
            <Text style={styles.quizHelp}>{askOffline ? offlineMessage() : t('Pregúntale al asistente sobre esta lección.')}</Text>
          </View>
          <Pressable accessibilityRole="button" disabled={askOffline} onPress={onAsk} style={[styles.quizButton, askOffline && { opacity: 0.5 }]} testID="lesson-ask">
            <Text style={styles.quizButtonText}>{t('Preguntar')}</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        disabled={busy || lesson.completed}
        onPress={onComplete}
        style={[styles.button, lesson.completed && styles.doneButton]}
      >
        {busy ? <ActivityIndicator color={colors.white} /> : (
          <Text style={styles.buttonText}>{lesson.completed ? t('Lección completada') : t('Marcar como completada')}</Text>
        )}
      </Pressable>
    </>
  );
}

function toPlayable(lesson: LessonDetail, multi: boolean): PlayableVideo[] {
  if (multi && Array.isArray(lesson.videos) && lesson.videos.length) {
    return lesson.videos.map((video, index) => ({
      key: video.key,
      index,
      title: video.title || `Video ${index + 1}`,
      url: video.url,
      embedUrl: video.embed_url || '',
      provider: video.provider,
      thumbnail: video.thumbnail_url,
      downloadable: video.downloadable,
      bytes: video.bytes,
    }));
  }
  // Servidor sin multi_video (o APK de este tipo contra servidores anteriores): un solo video, como en 0.4.0.
  if (!lesson.video_url && !lesson.video_embed_url) return [];
  return [{
    index: 0,
    title: lesson.title,
    url: lesson.video_url,
    embedUrl: lesson.video_embed_url || '',
    provider: lesson.video_embed_url ? 'google_drive' : '',
    thumbnail: lesson.video_thumbnail_url || '',
    downloadable: lesson.video_downloadable,
    bytes: lesson.video_bytes,
  }];
}

const slot = (video: PlayableVideo) => video.key ?? `#${video.index}`;

export function LessonScreen({ lessonId, token, onBack, onCompleted, onOpenQuiz, onOpenAssignment, onOpenResource, onAsk }: Props) {
  const { offline } = useNetworkState();
  const [assignmentsSupported, setAssignmentsSupported] = useState(false);
  const [assistantSupported, setAssistantSupported] = useState(false);
  const [multiVideo, setMultiVideo] = useState(false);
  const [savedResources, setSavedResources] = useState<Record<string, DownloadRecord>>({});
  const [resourceBusy, setResourceBusy] = useState('');
  const [localThumb, setLocalThumb] = useState<string | null>(null);
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [selected, setSelected] = useState(0);
  /** Descarga y posición de cada video, por `key` (o por posición con servidores anteriores). */
  const [videoDownloads, setVideoDownloads] = useState<Record<string, DownloadRecord | null>>({});
  const [resumes, setResumes] = useState<Record<string, number>>({});
  const [watched, setWatched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const videos = useMemo(() => (lesson ? toPlayable(lesson, multiVideo) : []), [lesson, multiVideo]);
  const current = videos[selected] ?? videos[0];
  const currentSlot = current ? slot(current) : '';
  const currentDownload = current ? videoDownloads[currentSlot] ?? null : null;
  const playableUrl = current && (current.provider === 'direct' || current.provider === '') ? current.url : '';
  const mediaUri = currentDownload?.localUri || playableUrl;

  const loadSavedResources = useCallback(async (id: number) => {
    const records = await listResourceDownloads(id).catch(() => []);
    setSavedResources(Object.fromEntries(records.filter((r) => r.resourceKey).map((r) => [r.resourceKey as string, r])));
  }, []);

  const currentKey = current?.key;
  const onPosition = useCallback((seconds: number, duration: number, final: boolean) => {
    setWatched((prev) => (prev[currentSlot] ? prev : { ...prev, [currentSlot]: true }));
    setResumes((prev) => ({ ...prev, [currentSlot]: Math.floor(seconds) }));
    void savePosition(lessonId, seconds, duration, currentKey)
      .then(() => (final ? flushOutbox(token) : null))
      .catch(() => undefined);
  }, [lessonId, token, currentKey, currentSlot]);

  useEffect(() => {
    let active = true;
    // Servidores anteriores a 6.27.0 / 6.28.2 no declaran la capacidad: la función se oculta.
    void getServerCapabilities().then((caps) => {
      if (!active) return;
      setAssignmentsSupported(Boolean(caps.assignments));
      setMultiVideo(Boolean(caps.multi_video));
      setAssistantSupported(Boolean(caps.ai_assistant));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const started = perfNow();
    Promise.all([fetchLesson(lessonId, token), getServerCapabilities()])
      .then(async ([value, caps]) => {
        const list = toPlayable(value, Boolean(caps.multi_video));
        const downloads: Record<string, DownloadRecord | null> = {};
        const positions: Record<string, number> = {};
        for (const video of list) {
          const isFirst = video.index === 0;
          downloads[slot(video)] = video.key
            ? await findVideoDownload(value.id, video.key, isFirst, video.url)
            : video.url ? await findLessonDownload(value.id, video.url) : null;
          const server = video.key ? value.videos?.[video.index]?.resume_position_seconds : value.resume_position_seconds;
          positions[slot(video)] = await resumePosition(value.id, server, video.key, isFirst);
        }
        if (!active) return;
        setLesson(value);
        // 1.0.0: apertura de la lección (con sus videos) en milisegundos.
        perfMark('lesson', perfNow() - started, false);
        setVideoDownloads(downloads);
        setResumes(positions);
        void reconcileLessonResources(value).catch(() => undefined).then(() => (active ? loadSavedResources(value.id) : undefined));
        // MP4 propio sin miniatura en el servidor: se genera una del primer segundo y se guarda.
        const existing = await getLocalThumbnail(value.id);
        if (existing) {
          if (active) setLocalThumb(existing);
        } else if (await needsLocalThumbnail(value)) {
          const first = list[0];
          const generated = await ensureLocalThumbnail(value.id, (first && downloads[slot(first)]?.localUri) || value.video_url);
          if (active && generated) setLocalThumb(generated);
        }
      })
      .catch(() => { if (active) setNotice(t('No pudimos cargar la lección.')); });
    return () => { active = false; };
  }, [lessonId, token, loadSavedResources]);

  const openLocal = async (record: DownloadRecord, title: string) => {
    const kind = viewerKind(record.mime, record.localUri);
    if (kind === 'system') {
      await openWithSystem(record.localUri, record.mime).catch(() => setNotice(t('No hay una app en el teléfono para abrir este archivo.')));
      return;
    }
    onOpenResource({ title, localUri: record.localUri, kind, mime: record.mime });
  };

  const pressResource = async (resource: LessonResource) => {
    if (!lesson) return;
    const saved = savedResources[resourceKey(lesson.id, resource)];
    if (saved) {
      await openLocal(saved, resource.title);
      return;
    }
    const target = resource.download_url || resource.url;
    if (!target) return;
    try {
      await Linking.openURL(target);
    } catch {
      setNotice(t('No se pudo abrir el enlace.'));
    }
  };

  const downloadOne = async (resource: LessonResource) => {
    if (!lesson) return;
    const key = resourceKey(lesson.id, resource);
    setResourceBusy(key);
    setNotice('');
    try {
      await downloadResource(lesson, resource);
      await loadSavedResources(lesson.id);
      setNotice(t('Material guardado: se abre sin conexión.'));
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : t('No fue posible descargar el material.'));
    } finally {
      setResourceBusy('');
    }
  };

  const removeOne = async (record: DownloadRecord) => {
    if (!lesson) return;
    await removeDownloadFile(record.localUri).catch(() => undefined);
    await loadSavedResources(lesson.id);
  };

  const thumbnailFor = (video: PlayableVideo) => (video.index === 0 && localThumb && (!video.thumbnail || video.provider === 'direct' || video.provider === '') ? localThumb : video.thumbnail);

  const saveDownload = async () => {
    if (!lesson || !current?.url) return;
    setDownloadBusy(true);
    setNotice('');
    try {
      const saved = await downloadLessonMedia(lesson.id, current.url, {
        courseId: lesson.course_id,
        title: videos.length > 1 ? `${lesson.title} · ${current.title}` : lesson.title,
        thumbnailUrl: thumbnailFor(current) || undefined,
        videoKey: current.key,
        isFirstVideo: current.index === 0,
      });
      setVideoDownloads((prev) => ({ ...prev, [currentSlot]: saved }));
      setNotice(t('Video guardado y listo para usar sin conexión.'));
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : t('No fue posible descargar el video.'));
    } finally {
      setDownloadBusy(false);
    }
  };

  const deleteDownload = () => {
    if (!lesson) return;
    Alert.alert(
      t('¿Eliminar descarga?'),
      t('El video dejará de estar disponible sin conexión. Podrás volver a descargarlo cuando tengas Wi-Fi.'),
      [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Eliminar'), style: 'destructive', onPress: () => void confirmDeleteDownload() },
      ],
    );
  };

  const confirmDeleteDownload = async () => {
    if (!lesson || !current) return;
    setDownloadBusy(true);
    try {
      if (current.key) await removeVideoDownload(lesson.id, current.key, current.index === 0);
      else await removeLessonDownload(lesson.id);
      setVideoDownloads((prev) => ({ ...prev, [currentSlot]: null }));
      setNotice(t('Descarga eliminada. El video seguirá disponible en línea.'));
    } catch {
      setNotice(t('No fue posible eliminar la descarga.'));
    } finally {
      setDownloadBusy(false);
    }
  };

  const markComplete = async () => {
    if (!lesson) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await completeLesson(lesson.id, token);
      setLesson({ ...lesson, completed: true });
      setNotice(result.queued ? t('Progreso guardado: se sincronizará al recuperar conexión.') : t('Progreso actualizado.'));
      onCompleted();
    } catch {
      setNotice(t('No fue posible actualizar el progreso.'));
    } finally {
      setBusy(false);
    }
  };

  if (!lesson && !notice) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  const videoArea = current ? (
    <>
      <VideoBlock
        key={`${currentSlot}-${mediaUri}`}
        video={{ ...current, thumbnail: thumbnailFor(current) }}
        mediaUri={mediaUri}
        downloaded={Boolean(currentDownload)}
        downloadBusy={downloadBusy}
        onDownload={() => void saveDownload()}
        onRemoveDownload={() => void deleteDownload()}
        resumeAt={resumes[currentSlot] ?? 0}
        onPosition={onPosition}
        durationBadge={videos.length === 1 && lesson?.duration_min ? `${lesson.duration_min} min` : undefined}
      />
      {videos.length > 1 ? (
        <View style={styles.videoList}>
          <Text style={styles.sectionTitle}>{t('Videos de la lección')}</Text>
          {videos.map((video) => {
            const id = slot(video);
            const isCurrent = id === currentSlot;
            const saved = Boolean(videoDownloads[id]);
            const seen = resumes[id] ?? 0;
            const status = saved
              ? 'Descargado'
              : video.downloadable ? `Se puede descargar${video.bytes ? ` · ${formatBytes(video.bytes)}` : ''}` : 'Solo con conexión';
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent }}
                onPress={() => setSelected(video.index)}
                style={[styles.videoRow, isCurrent && styles.videoRowCurrent]}
              >
                <MediaImage play uri={thumbnailFor(video)} style={styles.videoThumb} />
                <View style={styles.videoMeta}>
                  <Text style={styles.videoTitle}>{video.title}</Text>
                  <Text style={[styles.resourceStatus, saved && styles.resourceStatusOk]}>{status}</Text>
                  {isCurrent ? <Text style={styles.videoBadge}>{t('En el reproductor')}</Text>
                    : seen > 0 || watched[id] ? <Text style={styles.videoSeen}>{seen > 0 ? t('Visto hasta {time}', { time: formatClock(seen) }) : t('Visto')}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </>
  ) : (
    <View style={styles.mediaUnavailable}>
      <Text style={styles.mediaUnavailableText}>{t('Esta lección no tiene un video compatible configurado.')}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable hitSlop={12} onPress={onBack}><Text style={styles.back}>{t('← Volver al curso')}</Text></Pressable>
      {lesson ? (
        <LessonContent
          lesson={lesson}
          videoArea={videoArea}
          busy={busy}
          onComplete={markComplete}
          onOpenQuiz={onOpenQuiz}
          showAssignment={assignmentsSupported && Boolean(lesson.assignment_available)}
          onOpenAssignment={onOpenAssignment}
          savedResources={savedResources}
          resourceBusy={resourceBusy}
          onResourcePress={(resource) => void pressResource(resource)}
          onResourceDownload={(resource) => void downloadOne(resource)}
          onResourceRemove={(record) => void removeOne(record)}
          onAsk={assistantSupported && onAsk ? () => onAsk(lesson.title) : undefined}
          askOffline={offline}
        />
      ) : null}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  videoList: { gap: spacing.sm },
  videoRow: { minHeight: 44, alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: 'transparent', borderRadius: 14, borderWidth: 2, flexDirection: 'row', gap: spacing.md, padding: spacing.sm },
  videoRowCurrent: { borderColor: colors.blue },
  videoThumb: { borderRadius: 8, width: 112 },
  videoMeta: { flex: 1, gap: 2 },
  videoTitle: { color: colors.navy, fontWeight: '800' },
  videoBadge: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  videoSeen: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.md, padding: spacing.lg },
  back: { color: colors.blue, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 28, fontWeight: '900' },
  meta: { color: colors.muted, textTransform: 'capitalize' },
  video: { aspectRatio: 16 / 9, backgroundColor: colors.ink, borderRadius: 14, overflow: 'hidden', width: '100%' },
  embed: { backgroundColor: colors.ink, flex: 1 },
  embedOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  embedActions: { gap: spacing.xs },
  embedButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, minHeight: 46, justifyContent: 'center', padding: spacing.sm },
  embedButtonText: { color: colors.blue, fontWeight: '900' },
  embedHint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  mediaUnavailable: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 14, padding: spacing.lg },
  mediaUnavailableText: { color: colors.muted, lineHeight: 21, textAlign: 'center' },
  source: { color: colors.success, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  downloadButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, minHeight: 46, justifyContent: 'center', padding: spacing.sm },
  downloadText: { color: colors.blue, fontWeight: '800' },
  body: { color: colors.ink, fontSize: 17, lineHeight: 27 },
  resources: { gap: spacing.sm },
  sectionTitle: { color: colors.navy, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: colors.muted, lineHeight: 20 },
  resourceList: { gap: spacing.sm },
  resourceCard: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 16, flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', padding: spacing.md },
  resourceMeta: { minHeight: 44, justifyContent: 'center', flex: 1, gap: 4 },
  resourceType: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  resourceTitle: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  resourceDescription: { color: colors.ink, lineHeight: 19, opacity: 0.85 },
  resourceAction: { color: colors.blue, fontWeight: '900' },
  resourceActions: { alignItems: 'flex-end', gap: spacing.sm, minWidth: 72 },
  resourceRemove: { color: colors.red, fontWeight: '800' },
  resourceStatus: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  resourceStatusOk: { color: colors.success },
  onlineOnly: { color: colors.muted, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  resumeRow: { flexDirection: 'row', gap: spacing.sm },
  resumeButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46, padding: spacing.sm },
  resumePrimary: { backgroundColor: colors.blue },
  resumePrimaryText: { color: colors.white, fontWeight: '900' },
  resumeText: { color: colors.blue, fontWeight: '800' },
  quizCard: { backgroundColor: colors.navy, borderRadius: 18, gap: spacing.md, padding: spacing.lg },
  quizCopy: { gap: spacing.xs },
  quizEyebrow: { color: colors.mustard, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  quizTitle: { color: colors.white, fontSize: 21, fontWeight: '900' },
  quizHelp: { color: colors.primarySoft, lineHeight: 20 },
  quizButton: { alignItems: 'center', backgroundColor: colors.mustard, borderRadius: 12, minHeight: 52, justifyContent: 'center', padding: spacing.md },
  quizButtonText: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  button: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 14, minHeight: 52, justifyContent: 'center', padding: spacing.md },
  doneButton: { backgroundColor: colors.success },
  buttonText: { color: colors.white, fontWeight: '800' },
  notice: { color: colors.muted, textAlign: 'center' },
});
