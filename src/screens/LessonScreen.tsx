import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { completeLesson, fetchLesson } from '../api/courses';
import { colors, spacing } from '../theme';
import type { LessonDetail } from '../types';

type Props = { lessonId: number; token: string; onBack: () => void; onCompleted: () => void };

function LessonContent({
  lesson,
  busy,
  onComplete,
}: {
  lesson: LessonDetail;
  busy: boolean;
  onComplete: () => void;
}) {
  const player = useVideoPlayer(lesson.video_url || null);

  return (
    <>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.meta}>{lesson.duration_min} minutos · {lesson.type}</Text>
      {lesson.video_url ? (
        <VideoView
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
          player={player}
          style={styles.video}
        />
      ) : null}
      <Text style={styles.body}>{lesson.content_text || 'Esta lección no contiene texto adicional.'}</Text>
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

export function LessonScreen({ lessonId, token, onBack, onCompleted }: Props) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    fetchLesson(lessonId, token)
      .then((value) => { if (active) setLesson(value); })
      .catch(() => { if (active) setNotice('No pudimos cargar la lección.'); });
    return () => { active = false; };
  }, [lessonId, token]);

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
      {lesson ? <LessonContent lesson={lesson} busy={busy} onComplete={markComplete} /> : null}
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
  body: { color: colors.ink, fontSize: 17, lineHeight: 27 },
  button: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 14, minHeight: 52, justifyContent: 'center', padding: spacing.md },
  doneButton: { backgroundColor: colors.success },
  buttonText: { color: colors.white, fontWeight: '800' },
  notice: { color: colors.muted, textAlign: 'center' },
});
