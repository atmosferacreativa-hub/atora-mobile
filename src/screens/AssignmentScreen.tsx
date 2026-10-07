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
import { Button, Card } from '../components/ui';
import { useNetworkState } from '../hooks/useNetworkState';
import { dismissOutboxEvent, flushOutbox, listOutbox, subscribeOutbox } from '../offline/outbox/runtime';
import type { OutboxEvent } from '../offline/outbox/types';
import { colors, spacing } from '../theme';
import type { AssignmentResponse, AssignmentSubmission } from '../types';
import { locale, t } from '../i18n';

type Props = { lessonId: number; token: string; onBack: () => void };

type LocalEvent = OutboxEvent<AssignmentDraft>;

/** Fechas del servidor: UTC `Y-m-d H:i:s`. */
function fromServer(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) : '';
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
  if (submission.grade !== null && submission.grade !== undefined) return { label: `${t('Calificada')} · ${submission.grade}`, tone: 'graded' };
  // 6.29.0: guardada por el docente pero no liberada: no hay nota que mostrar.
  if (submission.in_review) return { label: t('En revisión'), tone: 'ok' };
  if (submission.is_late) return { label: t('Tardía'), tone: 'late' };
  return { label: t('Entregada'), tone: 'ok' };
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
      setError(reason instanceof ApiError ? reason.message : t('No pudimos cargar la tarea.'));
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
      setFormError(t('Escribe una respuesta o adjunta un archivo.'));
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
      setFormError(t('No pudimos guardar la entrega en el teléfono. Revisa el espacio disponible.'));
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
      <Pressable hitSlop={12} onPress={onBack}><Text style={styles.back}>{t('← Volver a la lección')}</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {assignment ? (
        <>
          <Text style={styles.eyebrow}>{t('TAREA')}</Text>
          <Text style={styles.title}>{assignment.title}</Text>
          <View style={styles.facts}>
            <Text style={styles.fact}>{due ? t('Fecha límite: {date}', { date: formatDate(due) }) : t('Sin fecha límite')}</Text>
            <Text style={styles.fact}>
              {t('Intentos usados: {count}', { count: used })}
              {remaining === null ? ` · ${t('sin límite')}` : ` · ${t('restantes: {count}', { count: remaining })}`}
            </Text>
          </View>
          {assignment.instructions_html ? <Text style={styles.body}>{htmlToText(assignment.instructions_html)}</Text> : null}

          {assignment.group_mode ? (
            <Text style={styles.notice}>{t('Esta es una tarea grupal: entrégala desde la web.')}</Text>
          ) : canSubmit ? (
            <Card>
              <Text style={styles.heading}>{t('Tu entrega')}</Text>
              <TextInput
                multiline
                onChangeText={setText}
                placeholder={t('Escribe tu respuesta (opcional si adjuntas archivos)')}
                style={styles.input}
                value={text}
              />
              {files.map((file, index) => (
                <View key={`${file.uri}-${index}`} style={styles.fileRow}>
                  <Text numberOfLines={2} ellipsizeMode="middle" style={styles.fileName}>{file.name}</Text>
                  <Pressable hitSlop={12} onPress={() => setFiles(files.filter((_, i) => i !== index))}>
                    <Text style={styles.link}>{t('Quitar')}</Text>
                  </Pressable>
                </View>
              ))}
              <Text style={styles.help}>
                {t('Formatos: {formats} · hasta {mb} MB · máximo {count} archivo(s).', { formats: assignment.accepted_files.extensions.join(', '), mb: (assignment.accepted_files.max_bytes / (1024 * 1024)).toFixed(0), count: assignment.accepted_files.max_files })}
              </Text>
              <Button disabled={busy} label={t('Adjuntar archivo')} onPress={() => void pick()} variant="secondary" />
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <Button busy={busy} label={t('Entregar')} onPress={() => void submit()} />
            </Card>
          ) : (
            <Text style={styles.notice}>{t('Ya no quedan intentos para esta tarea.')}</Text>
          )}

          {/* Solo mientras siga en la cola: al confirmarse, el historial muestra el intento. */}
          {saved && local.pending.length ? (
            <View style={styles.savedBox} accessibilityRole="alert">
              <Text style={styles.savedTitle}>{t('Guardada. Se enviará cuando tengas conexión.')}</Text>
              <Text style={styles.help}>{t('La hiciste el {date}. La academia decide si llegó a tiempo según cuándo la recibe.', { date: formatDate(saved) })}</Text>
            </View>
          ) : null}

          <Text style={styles.heading}>{t('Historial')}</Text>
          {!local.pending.length && !local.failed.length && !submissions.length ? (
            <Text style={styles.help}>{t('Todavía no entregaste esta tarea.')}</Text>
          ) : null}

          {local.pending.map((event) => {
            const progress = uploadProgress(event);
            return (
              <View key={event.id} style={styles.historyItem}>
                <Text style={[styles.badge, styles.badgeQueued]}>{progress !== null ? t('Subiendo · {percent}%', { percent: progress }) : t('En cola')}</Text>
                <Text style={styles.help}>{t('Hecha el {date}', { date: formatDate(new Date(event.payload.clientSubmittedAt)) })}</Text>
                <Text style={styles.help}>{t('Guardada. Se enviará cuando tengas conexión.')}</Text>
                {event.lastError ? <Text style={styles.help}>{t('Último intento: {error}', { error: event.lastError })}</Text> : null}
              </View>
            );
          })}

          {local.failed.map((event) => (
            <View key={event.id} style={styles.historyItem}>
              <Text style={[styles.badge, styles.badgeFailed]}>{t('No se pudo enviar')}</Text>
              <Text style={styles.help}>{t('Hecha el {date}', { date: formatDate(new Date(event.payload.clientSubmittedAt)) })}</Text>
              <Text style={styles.errorSmall}>{event.lastError}</Text>
              <Pressable hitSlop={12} onPress={() => void dismissOutboxEvent(event.id)}><Text style={styles.link}>{t('Descartar')}</Text></Pressable>
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
                  {t('Intento {n}', { n: submission.attempt })} · {status.label}
                </Text>
                {submission.client_submitted_at ? (
                  <Text style={styles.help}>{t('Hecha el {date}', { date: formatDate(fromServer(submission.client_submitted_at)) })}</Text>
                ) : null}
                <Text style={styles.help}>{t('Recibida el {date}', { date: formatDate(fromServer(submission.server_received_at)) })}</Text>
                {submission.files.length ? (
                  <Text style={styles.help}>{t('Archivos: {files}', { files: submission.files.map((file) => file.filename).join(', ') })}</Text>
                ) : null}
                {submission.feedback ? <Text style={styles.feedback}>“{submission.feedback}”</Text> : null}
                {submission.rubric?.rows?.length ? (
                  <View style={styles.rubric}>
                    <Text style={styles.rubricTitle}>{t('Rúbrica')}</Text>
                    {submission.rubric.rows.map((row, index) => (
                      <View key={`${row.name}-${index}`} style={styles.rubricRow}>
                        <View style={styles.rubricHead}>
                          <Text style={styles.rubricName}>{row.name}</Text>
                          <Text style={styles.rubricScore}>{row.score} / {row.max}</Text>
                        </View>
                        <View style={styles.rubricTrack}>
                          <View style={[styles.rubricFill, { width: `${Math.max(0, Math.min(100, (row.score / Math.max(1, row.max)) * 100))}%` }]} />
                        </View>
                        {row.level ? <Text style={styles.rubricLevel}>{t('Nivel: {level}', { level: row.level })}</Text> : null}
                        {row.competency ? <Text style={styles.help}>{t('Competencia: {name}', { name: row.competency })}</Text> : null}
                        {row.feedback ? <Text style={styles.feedback}>“{row.feedback}”</Text> : null}
                      </View>
                    ))}
                    {submission.rubric.strengths.length ? <Text style={styles.help}>{t('Fortalezas: {list}', { list: submission.rubric.strengths.join(', ') })}</Text> : null}
                    {submission.rubric.reinforce.length ? <Text style={styles.help}>{t('Para reforzar: {list}', { list: submission.rubric.reinforce.join(', ') })}</Text> : null}
                    {submission.rubric.recommendation ? <Text style={styles.help}>{t('Sugerencia: {text}', { text: submission.rubric.recommendation })}</Text> : null}
                  </View>
                ) : null}
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
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.navy, fontSize: 26, fontWeight: '900' },
  facts: { gap: 4 },
  fact: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  heading: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  input: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 15, minHeight: 110, padding: spacing.sm, textAlignVertical: 'top' },
  fileRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  fileName: { color: colors.ink, flex: 1, fontSize: 14 },
  link: { color: colors.blue, fontWeight: '800' },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  notice: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, padding: spacing.md },
  error: { color: colors.red, fontSize: 14 },
  errorSmall: { color: colors.red, fontSize: 12 },
  savedBox: { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 12, borderWidth: 1, gap: 4, padding: spacing.md },
  savedTitle: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  historyItem: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 12, borderWidth: 1, gap: 4, padding: spacing.md },
  badge: { alignSelf: 'flex-start', borderRadius: 999, fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeQueued: { backgroundColor: colors.accentSoft, color: colors.accentText },
  badgeFailed: { backgroundColor: colors.dangerSoft, color: colors.danger },
  badgeOk: { backgroundColor: colors.successSoft, color: colors.success },
  badgeLate: { backgroundColor: colors.accentSoft, color: colors.accentText },
  badgeGraded: { backgroundColor: colors.primarySoft, color: colors.primary },
  feedback: { color: colors.ink, fontSize: 14, fontStyle: 'italic' },
  rubric: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.sm, marginTop: spacing.xs, paddingTop: spacing.sm },
  rubricTitle: { color: colors.navy, fontWeight: '900' },
  rubricRow: { gap: 4 },
  rubricHead: { flexDirection: 'row', justifyContent: 'space-between' },
  rubricName: { color: colors.ink, flex: 1, fontWeight: '800' },
  rubricLevel: { color: colors.success, fontSize: 13, fontWeight: '800' },
  rubricScore: { color: colors.navy, fontVariant: ['tabular-nums'], fontWeight: '900' },
  rubricTrack: { backgroundColor: colors.border, borderRadius: 4, height: 6, overflow: 'hidden' },
  rubricFill: { backgroundColor: colors.success, height: 6 },
});
