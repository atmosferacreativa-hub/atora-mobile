import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { completeLesson, fetchLesson } from '../api/courses';
import {
  downloadLessonMedia,
  findLessonDownload,
  removeLessonDownload,
} from '../offline/mediaDownloads';
import { colors, spacing } from '../theme';
import type { LessonDetail } from '../types';

type Props = { lessonId: number; token: string; onBack: () => void; onCompleted: () => void; onOpenQuiz: () => void };

function LessonContent({
  lesson,
  mediaUri,
  downloaded,
  busy,
  downloadBusy,
  onComplete,
  onDownload,
  onRemoveDownload,
  onOpenQuiz,
}: {
  lesson: LessonDetail;
  mediaUri: string;
  downloaded: boolean;
  busy: boolean;
  downloadBusy: boolean;
  onComplete: () => void;
  onDownload: () => void;
  onRemoveDownload: () => void;
  onOpenQuiz: () => void;
}) {
  const player = useVideoPlayer(mediaUri || null);

  return (
    <>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.meta}>{lesson.duration_min} minutos · {lesson.type}</Text>
      {mediaUri ? (
        <>
          <VideoView
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
            player={player}
            style={styles.video}
          />
          <Text style={styles.source}>{downloaded ? 'Disponible sin conexión' : 'Reproducción en línea'}</Text>
          <Pressable
            disabled={downloadBusy}
            onPress={downloaded ? onRemoveDownload : onDownload}
            style={styles.downloadButton}
          >
            {downloadBusy ? <ActivityIndicator color={colors.blue} /> : (
              <Text style={styles.downloadText}>
                {downloaded ? 'Eliminar descarga' : 'Guardar para usar sin conexión'}
              </Text>
            )}
          </Pressable>
        </>
      ) : null}
      <Text style={styles.body}>{lesson.content_text || 'Esta lección no contiene texto adicional.'}</Text>
      {lesson.quiz_available ? (
        <View style={styles.quizCard}>
          <View style={styles.quizCopy}>
            <Text style={styles.quizEyebrow}>EVALUACIÓN</Text>
            <Text style={styles.quizTitle}>Comprueba lo aprendido</Text>
            <Text style={styles.quizHelp}>Responde con calma en una interfaz clara, una pregunta a la vez.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenQuiz} style={styles.quizButton}>
            <Text style={styles.quizButtonText}>Comenzar evaluación</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        disabled={busy || lesson.completed}
        onPress={onComplete}
        style={[styles.button, lesson.completed && styles.doneButton]}
      >
        {busy ? <ActivityIndicator color={colors.white} /> : (
          <Text style={styles.buttonText}>{lesson.completed ? 'Lección completada' : 'Marcar como completada'}</Text>
        )}
      </Pressable>
    </>
  );
}

export function LessonScreen({ lessonId, token, onBack, onCompleted, onOpenQuiz }: Props) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [mediaUri, setMediaUri] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    fetchLesson(lessonId, token)
      .then(async (value) => {
        const saved = value.video_url
          ? await findLessonDownload(value.id, value.video_url)
          : null;
        if (!active) return;
        setLesson(value);
        setMediaUri(saved?.localUri || value.video_url);
        setDownloaded(Boolean(saved));
      })
      .catch(() => { if (active) setNotice('No pudimos cargar la lección.'); });
    return () => { active = false; };
  }, [lessonId, token]);

  const saveDownload = async () => {
    if (!lesson?.video_url) return;
    setDownloadBusy(true);
    setNotice('');
    try {
      const saved = await downloadLessonMedia(lesson.id, lesson.video_url);
      setMediaUri(saved.localUri);
      setDownloaded(true);
      setNotice('Lección guardada y lista para usar sin conexión.');
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'No fue posible descargar la lección.');
    } finally {
      setDownloadBusy(false);
    }
  };

  const deleteDownload = async () => {
    if (!lesson) return;
    setDownloadBusy(true);
    try {
      await removeLessonDownload(lesson.id);
      setMediaUri(lesson.video_url);
      setDownloaded(false);
      setNotice('Descarga eliminada. La lección seguirá disponible en línea.');
    } catch {
      setNotice('No fue posible eliminar la descarga.');
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
      setNotice(result.queued ? 'Progreso guardado: se sincronizará al recuperar conexión.' : 'Progreso actualizado.');
      onCompleted();
    } catch {
      setNotice('No fue posible actualizar el progreso.');
    } finally {
      setBusy(false);
    }
  };

  if (!lesson && !notice) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack}><Text style={styles.back}>← Volver al curso</Text></Pressable>
      {lesson ? (
        <LessonContent
          key={mediaUri}
          lesson={lesson}
          mediaUri={mediaUri}
          downloaded={downloaded}
          busy={busy}
          downloadBusy={downloadBusy}
          onComplete={markComplete}
          onDownload={() => void saveDownload()}
          onRemoveDownload={() => void deleteDownload()}
          onOpenQuiz={onOpenQuiz}
        />
      ) : null}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.md, padding: spacing.lg },
  back: { color: colors.blue, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 28, fontWeight: '900' },
  meta: { color: colors.muted, textTransform: 'capitalize' },
  video: { aspectRatio: 16 / 9, backgroundColor: colors.ink, borderRadius: 14, width: '100%' },
  source: { color: colors.success, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  downloadButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, minHeight: 46, justifyContent: 'center', padding: spacing.sm },
  downloadText: { color: colors.blue, fontWeight: '800' },
  body: { color: colors.ink, fontSize: 17, lineHeight: 27 },
  quizCard: { backgroundColor: colors.navy, borderRadius: 18, gap: spacing.md, padding: spacing.lg },
  quizCopy: { gap: spacing.xs },
  quizEyebrow: { color: colors.mustard, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  quizTitle: { color: colors.white, fontSize: 21, fontWeight: '900' },
  quizHelp: { color: '#D8DEE8', lineHeight: 20 },
  quizButton: { alignItems: 'center', backgroundColor: colors.mustard, borderRadius: 12, minHeight: 52, justifyContent: 'center', padding: spacing.md },
  quizButtonText: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  button: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 14, minHeight: 52, justifyContent: 'center', padding: spacing.md },
  doneButton: { backgroundColor: colors.success },
  buttonText: { color: colors.white, fontWeight: '800' },
  notice: { color: colors.muted, textAlign: 'center' },
});
