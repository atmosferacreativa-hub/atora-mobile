import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  ASSIGNMENT_SUBMISSION,
  enqueueAssignmentSubmission,
  fetchAssignment,
  validateAttachments,
  type AssignmentDraft,
  type PickedFile,
} from '../api/assignments';
import { ApiError } from '../api/client';
import { useNetworkState } from '../hooks/useNetworkState';
import { dismissOutboxEvent, flushOutbox, listOutbox, subscribeOutbox } from '../offline/outbox/runtime';
import type { OutboxEvent } from '../offline/outbox/types';
import { colors, spacing } from '../theme';
import type { AssignmentResponse, AssignmentSubmission } from '../types';

type Props = { lessonId: number; token: string; onBack: () => void };

type LocalEvent = OutboxEvent<AssignmentDraft>;

/** Fechas del servidor: UTC `Y-m-d H:i:s`. */
function fromServer(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function serverStatus(submission: AssignmentSubmission): { label: string; tone: 'ok' | 'late' | 'graded' } {
  if (submission.grade !== null && submission.grade !== undefined) return { label: `Calificada · ${submission.grade}`, tone: 'graded' };
  if (submission.is_late) return { label: 'Tardía', tone: 'late' };
  return { label: 'Entregada', tone: 'ok' };
}

function uploadProgress(event: LocalEvent): number | null {
  const files = event.payload.files;
  if (!files.length) return null;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const sent = files.reduce((sum, file) => sum + (file.completed ? file.size : file.received ?? 0), 0);
  return sent > 0 && total > 0 ? Math.round((sent / total) * 100) : null;
}

export function AssignmentScreen({ lessonId, token, onBack }: Props) {
  const [data, setData] = useState<AssignmentResponse | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<{ pending: LocalEvent[]; failed: LocalEvent[] }>({ pending: [], failed: [] });
  const network = useNetworkState();
  const pendingCount = useRef(0);

  const load = useCallback(async () => {
    try {
      setData(await fetchAssignment(lessonId, token));
      setError('');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No pudimos cargar la tarea.');
    }
  }, [lessonId, token]);

  const loadLocal = useCallback(async () => {
    const all = await listOutbox().catch(() => ({ pending: [], failed: [] }));
    const mine = (event: OutboxEvent) =>
      event.type === ASSIGNMENT_SUBMISSION && (event.payload as AssignmentDraft).lessonId === lessonId;
    const next = { pending: all.pending.filter(mine) as LocalEvent[], failed: all.failed.filter(mine) as LocalEvent[] };
    // Cuando una entrega sale de la cola, el historial del servidor ya la incluye.
    if (next.pending.length < pendingCount.current) void load();
    pendingCount.current = next.pending.length;
    setLocal(next);
  }, [lessonId, load]);

  useEffect(() => {
    void load();
    void loadLocal();
    return subscribeOutbox(() => void loadLocal());
  }, [load, loadLocal]);

  const pick = async () => {
    setFormError('');
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled || !data) return;
    const next = [
      ...files,
      ...result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: asset.size ?? 0,
      })),
    ];
    const problem = validateAttachments(data.assignment.accepted_files, next);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFiles(next);
  };

  const submit = async () => {
    if (!data) return;
    setFormError('');
    if (!text.trim() && !files.length) {
      setFormError('Escribe una respuesta o adjunta un archivo.');
      return;
    }
    const problem = validateAttachments(data.assignment.accepted_files, files);
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy(true);
    try {
      const { clientSubmittedAt } = await enqueueAssignmentSubmission(lessonId, text.trim(), files);
      setSaved(new Date(clientSubmittedAt));
      setText('');
      setFiles([]);
      await loadLocal();
      if (!network.offline) void flushOutbox(token).catch(() => undefined);
    } catch {
      setFormError('No pudimos guardar la entrega en el teléfono. Revisa el espacio disponible.');
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) {
    return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;
  }

  const assignment = data?.assignment;
  const submissions = data?.submissions ?? [];
  const used = submissions.length + local.pending.length;
  const remaining = assignment?.attempts_allowed == null ? null : Math.max(0, assignment.attempts_allowed - used);
  const canSubmit = Boolean(assignment && !assignment.group_mode && (remaining === null || remaining > 0));
  const due = fromServer(assignment?.due_at ?? null);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack}><Text style={styles.back}>← Volver a la lección</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {assignment ? (
        <>
          <Text style={styles.eyebrow}>TAREA</Text>
          <Text style={styles.title}>{assignment.title}</Text>
          <View style={styles.facts}>
            <Text style={styles.fact}>{due ? `Fecha límite: ${formatDate(due)}` : 'Sin fecha límite'}</Text>
            <Text style={styles.fact}>
              Intentos usados: {used}
              {remaining === null ? ' · sin límite' : ` · restantes: ${remaining}`}
            </Text>
          </View>
          {assignment.instructions_html ? <Text style={styles.body}>{htmlToText(assignment.instructions_html)}</Text> : null}

          {assignment.group_mode ? (
            <Text style={styles.notice}>Esta es una tarea grupal: entrégala desde la web.</Text>
          ) : canSubmit ? (
            <View style={styles.card}>
              <Text style={styles.heading}>Tu entrega</Text>
              <TextInput
                multiline
                onChangeText={setText}
                placeholder="Escribe tu respuesta (opcional si adjuntas archivos)"
                style={styles.input}
                value={text}
              />
              {files.map((file, index) => (
                <View key={`${file.uri}-${index}`} style={styles.fileRow}>
                  <Text numberOfLines={1} style={styles.fileName}>{file.name}</Text>
                  <Pressable onPress={() => setFiles(files.filter((_, i) => i !== index))}>
                    <Text style={styles.link}>Quitar</Text>
                  </Pressable>
                </View>
              ))}
              <Text style={styles.help}>
                Formatos: {assignment.accepted_files.extensions.join(', ')} · hasta {(assignment.accepted_files.max_bytes / (1024 * 1024)).toFixed(0)} MB
                · máximo {assignment.accepted_files.max_files} archivo(s).
              </Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void pick()} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Adjuntar archivo</Text>
              </Pressable>
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={styles.primaryButton}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Entregar</Text>}
              </Pressable>
            </View>
          ) : (
            <Text style={styles.notice}>Ya no quedan intentos para esta tarea.</Text>
          )}

          {saved ? (
            <View style={styles.savedBox} accessibilityRole="alert">
              <Text style={styles.savedTitle}>Guardada. Se enviará cuando tengas conexión.</Text>
              <Text style={styles.help}>La hiciste el {formatDate(saved)}. La academia decide si llegó a tiempo según cuándo la recibe.</Text>
            </View>
          ) : null}

          <Text style={styles.heading}>Historial</Text>
          {!local.pending.length && !local.failed.length && !submissions.length ? (
            <Text style={styles.help}>Todavía no entregaste esta tarea.</Text>
          ) : null}

          {local.pending.map((event) => {
            const progress = uploadProgress(event);
            return (
              <View key={event.id} style={styles.historyItem}>
                <Text style={[styles.badge, styles.badgeQueued]}>{progress !== null ? `Subiendo · ${progress}%` : 'En cola'}</Text>
                <Text style={styles.help}>Hecha el {formatDate(new Date(event.payload.clientSubmittedAt))}</Text>
                <Text style={styles.help}>Guardada. Se enviará cuando tengas conexión.</Text>
                {event.lastError ? <Text style={styles.help}>Último intento: {event.lastError}</Text> : null}
              </View>
            );
          })}

          {local.failed.map((event) => (
            <View key={event.id} style={styles.historyItem}>
              <Text style={[styles.badge, styles.badgeFailed]}>No se pudo enviar</Text>
              <Text style={styles.help}>Hecha el {formatDate(new Date(event.payload.clientSubmittedAt))}</Text>
              <Text style={styles.errorSmall}>{event.lastError}</Text>
              <Pressable onPress={() => void dismissOutboxEvent(event.id)}><Text style={styles.link}>Descartar</Text></Pressable>
            </View>
          ))}

          {submissions.map((submission) => {
            const status = serverStatus(submission);
            return (
              <View key={submission.id} style={styles.historyItem}>
                <Text
                  style={[
                    styles.badge,
                    status.tone === 'graded' ? styles.badgeGraded : status.tone === 'late' ? styles.badgeLate : styles.badgeOk,
                  ]}
                >
                  Intento {submission.attempt} · {status.label}
                </Text>
                {submission.client_submitted_at ? (
                  <Text style={styles.help}>Hecha el {formatDate(fromServer(submission.client_submitted_at))}</Text>
                ) : null}
                <Text style={styles.help}>Recibida el {formatDate(fromServer(submission.server_received_at))}</Text>
                {submission.files.length ? (
                  <Text style={styles.help}>Archivos: {submission.files.map((file) => file.filename).join(', ')}</Text>
                ) : null}
                {submission.feedback ? <Text style={styles.feedback}>“{submission.feedback}”</Text> : null}
              </View>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.md, padding: spacing.lg },
  back: { color: colors.blue, fontWeight: '800' },
  eyebrow: { color: colors.mustard, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.navy, fontSize: 26, fontWeight: '900' },
  facts: { gap: 4 },
  fact: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  heading: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  input: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 15, minHeight: 110, padding: spacing.sm, textAlignVertical: 'top' },
  fileRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  fileName: { color: colors.ink, flex: 1, fontSize: 14 },
  link: { color: colors.blue, fontWeight: '800' },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  notice: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, padding: spacing.md },
  error: { color: colors.red, fontSize: 14 },
  errorSmall: { color: colors.red, fontSize: 12 },
  secondaryButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 12, borderWidth: 1, padding: spacing.sm },
  secondaryText: { color: colors.blue, fontWeight: '800' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 12, padding: spacing.md },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  savedBox: { backgroundColor: '#FFF8E6', borderColor: colors.mustard, borderRadius: 12, borderWidth: 1, gap: 4, padding: spacing.md },
  savedTitle: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  historyItem: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 12, borderWidth: 1, gap: 4, padding: spacing.md },
  badge: { alignSelf: 'flex-start', borderRadius: 999, fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeQueued: { backgroundColor: '#FFF1CC', color: '#7A5A00' },
  badgeFailed: { backgroundColor: '#FDE2E2', color: colors.red },
  badgeOk: { backgroundColor: '#E2F2EA', color: colors.success },
  badgeLate: { backgroundColor: '#FDEBD3', color: '#8A4B00' },
  badgeGraded: { backgroundColor: '#E1ECF7', color: colors.blue },
  feedback: { color: colors.ink, fontSize: 14, fontStyle: 'italic' },
});
