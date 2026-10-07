import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { downloadSubmissionFile, fetchSubmissionDetail, gradeSubmission } from '../../api/teacher';
import { getSessionUserId } from '../../api/session';
import { fetchSuggestionJob, requestSuggestion } from '../../api/ai';
import { ApiError } from '../../api/client';
import { getServerCapabilities } from '../../api/discovery';
import { limitMessage } from '../../ai/conversation';
import { applySuggestion, LIKELIHOOD_LABEL, NO_MARKS, pollSuggestion, unmarkCriterion, unmarkFeedback, type AiMarks, type GradingSuggestion } from '../../ai/suggestion';
import { newEventId } from '../../offline/outbox/runtime';
import { sqliteGradingDraftStore } from '../../grading/draftStore';
import { discardDraft, expectedRevision, recoverDraft, saveDraft, type CriterionDraft, type GradingDraft } from '../../grading/drafts';
import { buildBands, describe as describeScore, parseFinalGrade, parseScore, rubricTotal } from '../../grading/rubric';
import { useNetworkState } from '../../hooks/useNetworkState';
import { viewerKind } from '../../viewer/files';
import { colors, radius, spacing } from '../../theme';
import type { SubmissionDetail, SubmissionFileRef } from '../../teacher/types';

type Props = {
  token: string;
  submissionId: number;
  onBack: () => void;
  onOpenFile: (params: { title: string; localUri: string; kind: 'pdf' | 'image'; mime?: string }) => void;
  onOpenWithSystem: (localUri: string, mime?: string) => void;
  onNext: () => void;
};

type Form = { attempt: number; scores: Record<number, CriterionDraft>; feedback: string; grade: string };

function formFrom(detail: SubmissionDetail): Form {
  const scores: Record<number, CriterionDraft> = {};
  for (const criterion of detail.rubric?.criteria ?? []) {
    scores[criterion.index] = { score: criterion.score === null ? '' : String(criterion.score), feedback: criterion.feedback ?? '' };
  }
  const last = detail.attempts.length ? detail.attempts[detail.attempts.length - 1]!.attempt : 1;
  return { attempt: detail.graded_attempt || last, scores, feedback: detail.feedback ?? '', grade: detail.grade === null ? '' : String(detail.grade) };
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '');

/** Calificar una entrega (0.8.0): visor, intentos, rúbrica táctil con decimales, borrador o publicar. */
export function GradeSubmissionScreen({ token, submissionId, onBack, onOpenFile, onOpenWithSystem, onNext }: Props) {
  const { offline } = useNetworkState();
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<'draft' | 'published' | null>(null);
  const [conflict, setConflict] = useState<{ message: string; theirs: SubmissionDetail } | null>(null);
  /** 0.8.1: borrador recuperado después de que otro docente guardó (se muestra su versión al lado). */
  const [otherVersion, setOtherVersion] = useState<SubmissionDetail | null>(null);
  const [opening, setOpening] = useState(0);
  /** 0.9.0: sugerencia de IA. Solo rellena el borrador; nunca guarda. */
  const [aiEnabled, setAiEnabled] = useState(false);
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'ready' | 'error'; suggestion?: GradingSuggestion; message?: string }>({ state: 'idle' });
  const [aiMarks, setAiMarks] = useState<AiMarks>(NO_MARKS);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => { void getServerCapabilities().then((caps) => setAiEnabled(Boolean(caps.ai_grading_suggestion))); }, []);
  const userId = useRef<number | null>(null);
  /** El formulario tal como está en el servidor: sin cambios no hay borrador local. */
  const pristine = useRef<Form | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchSubmissionDetail(token, submissionId);
      userId.current = await getSessionUserId();
      setDetail(data);
      setRevision(data.revision);
      const base = formFrom(data);
      pristine.current = base;
      setForm(base);
      const recovered = userId.current ? await recoverDraft(sqliteGradingDraftStore, userId.current, submissionId, data.revision).catch(() => null) : null;
      if (recovered) {
        Alert.alert(
          'Borrador guardado en el teléfono',
          `${recovered.staleRevision ? 'Otro docente guardó esta entrega después de que empezaste. ' : ''}¿Recuperar lo que escribiste el ${new Date(recovered.draft.savedAt).toLocaleString('es')}?`,
          [
            { text: 'Descartar', style: 'destructive', onPress: () => void discardDraft(sqliteGradingDraftStore, userId.current!, submissionId) },
            {
              text: 'Recuperar',
              onPress: () => {
                setForm({ attempt: recovered.draft.attempt, scores: recovered.draft.scores, feedback: recovered.draft.feedback, grade: recovered.draft.grade });
                // El borrador conserva su revisión: guardar sin confirmar provoca el 409 en vez de pisar la otra nota.
                setRevision(expectedRevision(recovered.draft.revision, data.revision, false));
                if (recovered.staleRevision) setOtherVersion(data);
              },
            },
          ],
        );
      }
    } catch {
      setError(offline ? 'Calificar necesita conexión. Lo que escribas se guarda en el teléfono.' : 'No pudimos abrir la entrega.');
    }
  }, [token, submissionId, offline]);

  useEffect(() => { void load(); }, [load]);

  // El borrador local se guarda a cada cambio; nunca se envía solo.
  useEffect(() => {
    if (!form || !userId.current || saved === 'published' || form === pristine.current) return;
    const draft: GradingDraft = { submissionId, revision, attempt: form.attempt, scores: form.scores, feedback: form.feedback, grade: form.grade, savedAt: Date.now() };
    void saveDraft(sqliteGradingDraftStore, userId.current, draft).catch(() => undefined);
  }, [form, revision, submissionId, saved]);

  const criteria = detail?.rubric?.criteria ?? [];
  const checks = useMemo(() => criteria.map((c) => parseScore(form?.scores[c.index]?.score ?? '', c.max_points, c.name)), [criteria, form]);
  const total = rubricTotal(criteria.map((c, i) => ({ maxPoints: c.max_points, score: checks[i]?.ok ? (checks[i] as { value: number | null }).value : null })));
  const attempt = detail?.attempts.find((a) => a.attempt === form?.attempt) ?? detail?.attempts[detail.attempts.length - 1];

  const setScore = (index: number, patch: Partial<CriterionDraft>) => {
    setAiMarks((marks) => unmarkCriterion(marks, index));
    setForm((current) => (current ? { ...current, scores: { ...current.scores, [index]: { score: '', feedback: '', ...current.scores[index], ...patch } } } : current));
  };

  const askSuggestion = async () => {
    if (offline) {
      Alert.alert('Sin conexión', 'La sugerencia de IA necesita conexión.');
      return;
    }
    setAi({ state: 'loading' });
    try {
      const job = await requestSuggestion(token, submissionId);
      const result = await pollSuggestion(job.job_id, {
        fetch: (id) => fetchSuggestionJob(token, id),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(),
        cancelled: () => !mounted.current,
      });
      if (!mounted.current || result.kind === 'cancelled') return;
      if (result.kind === 'done') setAi({ state: 'ready', suggestion: result.suggestion });
      else setAi({ state: 'error', message: result.kind === 'failed' ? result.message : 'La sugerencia tardó demasiado. Intenta más tarde.' });
    } catch (reason) {
      if (!mounted.current) return;
      const message = reason instanceof ApiError && reason.status === 429 ? limitMessage(reason.message, reason.data?.reset_at) : reason instanceof Error ? reason.message : 'No se pudo pedir la sugerencia.';
      setAi({ state: 'error', message });
    }
  };

  /** "Usar todo" (sin índice) o "Usar" en un criterio: solo el borrador local. */
  const useSuggestion = (only?: number) => {
    if (!form || !ai.suggestion) return;
    const filled = applySuggestion(form, aiMarks, ai.suggestion, only);
    setAiMarks(filled.marks);
    setForm({ ...form, scores: filled.scores, feedback: filled.feedback });
  };

  const openFile = async (file: SubmissionFileRef) => {
    setOpening(file.id);
    try {
      const localUri = await downloadSubmissionFile(token, submissionId, file);
      const kind = viewerKind(file.mime_type, file.filename);
      if (kind === 'system') onOpenWithSystem(localUri, file.mime_type);
      else onOpenFile({ title: file.filename, localUri, kind, mime: file.mime_type });
    } catch (reason) {
      Alert.alert('No se pudo abrir', reason instanceof Error ? reason.message : 'Inténtalo otra vez.');
    } finally {
      setOpening(0);
    }
  };

  const submit = async (publish: boolean, expected = revision) => {
    if (!form || !detail) return;
    const invalid = checks.find((check) => !check.ok);
    if (invalid && !invalid.ok) {
      Alert.alert('Revisa la rúbrica', invalid.error);
      return;
    }
    const grade = parseFinalGrade(form.grade);
    if (!grade.ok) {
      Alert.alert('Revisa la nota final', grade.error);
      return;
    }
    if (offline) {
      Alert.alert('Sin conexión', 'Calificar necesita conexión. Tu borrador sigue guardado en el teléfono.');
      return;
    }
    setBusy(true);
    try {
      const outcome = await gradeSubmission(token, submissionId, {
        scores: criteria.map((c, i) => ({ index: c.index, score: checks[i]?.ok ? (checks[i] as { value: number | null }).value : null, feedback: form.scores[c.index]?.feedback ?? '' })),
        feedback: form.feedback,
        grade: grade.value,
        publish,
        attempt: form.attempt,
        expected_revision: expected,
        client_event_id: newEventId(),
      });
      if (outcome.kind === 'conflict') {
        setConflict({ message: outcome.message, theirs: outcome.submission });
        return;
      }
      pristine.current = form;
      if (userId.current) await discardDraft(sqliteGradingDraftStore, userId.current, submissionId).catch(() => undefined);
      setDetail(outcome.submission);
      setRevision(outcome.submission.revision);
      setSaved(publish ? 'published' : 'draft');
    } catch (reason) {
      Alert.alert('No se guardó', reason instanceof Error ? reason.message : 'Inténtalo otra vez. Tu borrador sigue en el teléfono.');
    } finally {
      setBusy(false);
    }
  };

  const confirmPublish = () =>
    Alert.alert('¿Publicar la calificación?', detail?.group ? 'El estudiante verá la nota y recibirá un aviso. La nota se aplica a todos los integrantes del grupo.' : 'El estudiante verá la nota y los comentarios, y recibirá un aviso.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Publicar', onPress: () => void submit(true) },
    ]);

  if (!detail || !form) {
    return (
      <View style={styles.center}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.link}><Text style={styles.linkText}>Volver</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryStrong} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{detail.lesson.title.toUpperCase()}</Text>
          <Text style={styles.title}>{detail.student.name}</Text>
          <Text style={styles.meta}>{detail.course.title}</Text>
        </View>
      </View>

      {detail.group ? (
        <View style={styles.group} testID="grading-group">
          <Ionicons name="people" size={18} color={colors.primaryStrong} />
          <Text style={styles.groupText}>
            Entrega grupal · {detail.group.name}: la nota se aplica a todos los integrantes ({detail.group.members.map((m) => m.name).join(', ')}).
          </Text>
        </View>
      ) : null}

      {otherVersion ? (
        <View style={styles.theirs} testID="grading-other-version">
          <Text style={styles.criterion}>Otro docente guardó esta entrega después de tu borrador</Text>
          <Text style={styles.meta}>Su versión · Estado: {otherVersion.status === 'graded' ? 'Publicada' : 'Borrador'} · Nota: {otherVersion.grade ?? 'sin nota'}</Text>
          {(otherVersion.rubric?.criteria ?? []).map((c) => (
            <Text key={c.index} style={styles.meta}>{c.name}: {c.score ?? '—'}{c.level ? ` (${c.level})` : ''}</Text>
          ))}
          {otherVersion.feedback ? <Text style={styles.meta}>“{otherVersion.feedback}”</Text> : null}
          <Text style={styles.meta}>Abajo está tu borrador. Al guardar se te pedirá confirmar si quieres reemplazar su versión.</Text>
        </View>
      ) : null}

      {offline ? <Text style={styles.offline}>Sin conexión: calificar necesita conexión. Lo que escribas queda guardado en el teléfono.</Text> : null}

      {detail.attempts.length > 1 ? (
        <View style={styles.chips}>
          {detail.attempts.map((item) => (
            <Pressable key={item.attempt} accessibilityRole="button" onPress={() => setForm({ ...form, attempt: item.attempt })} style={[styles.chip, form.attempt === item.attempt && styles.chipOn]}>
              <Text style={[styles.chipText, form.attempt === item.attempt && styles.chipTextOn]}>Intento {item.attempt}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {attempt ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Intento {attempt.attempt}{attempt.is_late ? ' · Tardía' : ''}</Text>
          <Text style={styles.meta}>Entregada el {when(attempt.server_received_at)} · {attempt.source === 'mobile' ? 'App' : 'Web'}</Text>
          {attempt.client_submitted_at ? <Text style={styles.meta}>Realizada sin conexión el {when(attempt.client_submitted_at)}</Text> : null}
          {attempt.body_text ? <Text style={styles.body}>{attempt.body_text}</Text> : null}
          {attempt.files.map((file) => (
            <Pressable key={file.id} accessibilityRole="button" onPress={() => void openFile(file)} style={styles.file} testID={`grading-file-${file.id}`}>
              <Ionicons name={viewerKind(file.mime_type, file.filename) === 'pdf' ? 'document-text-outline' : viewerKind(file.mime_type, file.filename) === 'image' ? 'image-outline' : 'attach-outline'} size={20} color={colors.primary} />
              <Text style={[styles.fileName, styles.flex]} numberOfLines={1}>{file.filename || 'Archivo'}</Text>
              {opening === file.id ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="open-outline" size={18} color={colors.textMuted} />}
            </Pressable>
          ))}
        </View>
      ) : null}

      {aiEnabled && detail.ai_suggestion_available && saved !== 'published' ? (
        <View style={styles.aiCard} testID="ai-suggestion">
          <View style={styles.scoreRow}>
            <Ionicons name="sparkles-outline" size={20} color={colors.primaryStrong} />
            <Text style={[styles.heading, styles.flex]}>Sugerencia de IA</Text>
          </View>
          <Text style={styles.meta}>La IA sugiere; tú decides. Usarla solo rellena tu borrador: nada se guarda ni se publica hasta que tú lo hagas.</Text>
          {ai.state === 'idle' || ai.state === 'error' ? (
            <Pressable accessibilityRole="button" disabled={offline} onPress={() => void askSuggestion()} style={[styles.copy, offline && styles.disabled]} testID="ai-suggestion-request">
              <Text style={styles.copyText}>{ai.state === 'error' ? 'Pedir otra vez' : 'Sugerencia de IA'}</Text>
            </Pressable>
          ) : null}
          {ai.state === 'loading' ? (
            <View style={styles.scoreRow}><ActivityIndicator color={colors.primary} /><Text style={styles.meta}>Generando la sugerencia…</Text></View>
          ) : null}
          {ai.state === 'error' ? <Text style={styles.error} testID="ai-suggestion-error">{ai.message}</Text> : null}
          {ai.state === 'ready' && ai.suggestion ? (
            <View style={styles.aiBody} testID="ai-suggestion-ready">
              {ai.suggestion.criteria.map((row) => (
                <View key={row.index} style={styles.aiRow}>
                  <View style={styles.flex}>
                    <Text style={styles.criterion}>{row.name}: {row.score ?? '—'} de {row.max_points}{row.level ? ` · ${row.level}` : ''}</Text>
                    <Text style={styles.meta}>{row.justification}</Text>
                  </View>
                  {row.score !== null ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Usar sugerencia para ${row.name}`} onPress={() => useSuggestion(row.index)} style={styles.copy} testID={`ai-use-${row.index}`}>
                      <Text style={styles.copyText}>Usar</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {ai.suggestion.feedback ? <Text style={styles.body}>{ai.suggestion.feedback}</Text> : null}
              <View style={styles.likelihood} testID="ai-likelihood">
                <Text style={styles.criterion}>Indicio de texto generado por IA: {LIKELIHOOD_LABEL[ai.suggestion.ai_likelihood]}</Text>
                {ai.suggestion.ai_likelihood_note ? <Text style={styles.meta}>{ai.suggestion.ai_likelihood_note}</Text> : null}
                <Text style={styles.likelihoodNote}>{ai.suggestion.disclaimer}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={() => useSuggestion()} style={styles.secondary} testID="ai-use-all">
                  <Text style={styles.secondaryText}>Usar todo</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void askSuggestion()} style={styles.secondary} testID="ai-suggestion-again">
                  <Text style={styles.secondaryText}>Pedir otra</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {criteria.length ? <Text style={styles.heading}>Rúbrica · {detail.rubric?.title}</Text> : null}
      {criteria.map((criterion, i) => {
        const draft = form.scores[criterion.index] ?? { score: '', feedback: '' };
        const check = checks[i];
        const value = check?.ok ? (check as { value: number | null }).value : null;
        const bands = buildBands(criterion.levels, criterion.max_points);
        return (
          <View key={criterion.index} style={styles.card} testID={`criterion-${criterion.index}`}>
            <Text style={styles.criterion}>{criterion.name}</Text>
            {aiMarks.criteria.includes(criterion.index) ? <Text style={styles.aiMark} testID={`ai-mark-${criterion.index}`}>Sugerido por IA</Text> : null}
            {criterion.description ? <Text style={styles.meta}>{criterion.description}</Text> : null}
            <View style={styles.chips}>
              {criterion.levels.map((level) => (
                <Pressable
                  key={`${level.label}-${level.points}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${level.label}, ${level.points} puntos`}
                  onPress={() => setScore(criterion.index, { score: String(level.points) })}
                  style={[styles.level, value !== null && value === level.points && styles.levelOn]}
                >
                  <Text style={[styles.levelLabel, value !== null && value === level.points && styles.chipTextOn]}>{level.label}</Text>
                  <Text style={[styles.levelPoints, value !== null && value === level.points && styles.chipTextOn]}>{level.points}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.scoreRow}>
              <TextInput
                accessibilityLabel={`Puntaje de ${criterion.name}`}
                keyboardType="decimal-pad"
                onChangeText={(text) => setScore(criterion.index, { score: text })}
                placeholder="Puntaje"
                style={[styles.input, styles.score]}
                testID={`score-${criterion.index}`}
                value={draft.score}
              />
              <Text style={styles.meta}>de {criterion.max_points}</Text>
              <Text style={[styles.band, styles.flex]} testID={`band-${criterion.index}`}>{value !== null ? describeScore(bands, value) : ''}</Text>
            </View>
            {check && !check.ok ? <Text style={styles.error}>{check.error}</Text> : null}
            <TextInput
              accessibilityLabel={`Comentario de ${criterion.name}`}
              multiline
              onChangeText={(text) => setScore(criterion.index, { feedback: text })}
              placeholder="Comentario del criterio"
              style={styles.input}
              value={draft.feedback}
            />
          </View>
        );
      })}

      {criteria.length ? (
        <View style={styles.totals}>
          <Text style={styles.heading} testID="rubric-total">Total {total.earned} de {total.max}{total.percent !== null ? ` · ${total.percent} %` : ''}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.heading}>Nota final (0–100)</Text>
        <View style={styles.scoreRow}>
          <TextInput accessibilityLabel="Nota final" keyboardType="number-pad" onChangeText={(text) => setForm({ ...form, grade: text })} placeholder="Opcional" style={[styles.input, styles.score]} testID="final-grade" value={form.grade} />
          {total.percent !== null ? (
            <Pressable accessibilityRole="button" onPress={() => setForm({ ...form, grade: String(total.percent) })} style={styles.copy} testID="copy-rubric-percent">
              <Text style={styles.copyText}>Copiar % de la rúbrica</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.heading}>Comentario general</Text>
        {aiMarks.feedback ? <Text style={styles.aiMark} testID="ai-mark-feedback">Sugerido por IA</Text> : null}
        <TextInput accessibilityLabel="Comentario general" multiline onChangeText={(text) => { setAiMarks(unmarkFeedback); setForm({ ...form, feedback: text }); }} placeholder="Retroalimentación para el estudiante" style={[styles.input, styles.feedback]} testID="general-feedback" value={form.feedback} />
      </View>

      {saved ? (
        <View style={styles.saved} testID="grading-saved">
          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
          <Text style={styles.savedText}>{saved === 'published' ? 'Calificación publicada' : 'Borrador guardado: el estudiante todavía no la ve'}</Text>
          <Pressable accessibilityRole="button" onPress={onNext} style={styles.next} testID="grading-next">
            <Text style={styles.nextText}>Siguiente entrega</Text>
          </Pressable>
        </View>
      ) : null}
      {saved === 'published' ? null : (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit(false)} style={[styles.secondary, busy && styles.disabled]} testID="grading-save-draft">
            <Text style={styles.secondaryText}>Guardar borrador</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={confirmPublish} style={[styles.primary, busy && styles.disabled]} testID="grading-publish">
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Publicar</Text>}
          </Pressable>
        </View>
      )}

      <Modal transparent visible={Boolean(conflict)} animationType="fade" onRequestClose={() => setConflict(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modal} testID="grading-conflict">
            <Text style={styles.heading}>Otro docente calificó primero</Text>
            <Text style={styles.meta}>{conflict?.message}</Text>
            {conflict ? (
              <View style={styles.theirs}>
                <Text style={styles.criterion}>Su versión</Text>
                <Text style={styles.meta}>Estado: {conflict.theirs.status === 'graded' ? 'Publicada' : 'Borrador'} · Nota: {conflict.theirs.grade ?? 'sin nota'}</Text>
                {(conflict.theirs.rubric?.criteria ?? []).map((c) => (
                  <Text key={c.index} style={styles.meta}>{c.name}: {c.score ?? '—'}{c.level ? ` (${c.level})` : ''}</Text>
                ))}
                {conflict.theirs.feedback ? <Text style={styles.meta}>“{conflict.theirs.feedback}”</Text> : null}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!conflict) return;
                const theirs = formFrom(conflict.theirs);
                pristine.current = theirs;
                setDetail(conflict.theirs);
                setRevision(conflict.theirs.revision);
                setForm(theirs);
                setConflict(null);
              }}
              style={[styles.primary, styles.modalButton]}
              testID="conflict-review"
            >
              <Text style={styles.primaryText}>Revisar su versión</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!conflict) return;
                const theirs = conflict.theirs;
                setConflict(null);
                Alert.alert('¿Reemplazar su calificación?', 'Se guardará tu versión sobre la del otro docente.', [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Reemplazar',
                    style: 'destructive',
                    onPress: () => {
                      const current = expectedRevision(null, theirs.revision, true);
                      setRevision(current);
                      setOtherVersion(null);
                      void submit(false, current);
                    },
                  },
                ]);
              }}
              style={[styles.secondary, styles.modalButton]}
              testID="conflict-keep-mine"
            >
              <Text style={styles.secondaryText}>Reemplazar con mi borrador</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConflict(null)} style={styles.link}><Text style={styles.linkText}>Cancelar</Text></Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  center: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 13 },
  error: { color: colors.danger },
  offline: { backgroundColor: colors.accentSoft, borderRadius: radius.md, color: colors.accentText, padding: spacing.md },
  group: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  groupText: { color: colors.primaryStrong, flex: 1, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  heading: { color: colors.primaryStrong, fontSize: 16, fontWeight: '900' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  file: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  fileName: { color: colors.text, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderColor: colors.line, borderRadius: 16, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextOn: { color: colors.white },
  criterion: { color: colors.text, fontSize: 16, fontWeight: '900' },
  level: { alignItems: 'center', borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, minWidth: 72, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  levelOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  levelPoints: { color: colors.textMuted, fontSize: 12 },
  scoreRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 15, padding: spacing.sm },
  score: { minWidth: 90 },
  band: { color: colors.primaryStrong, fontWeight: '800' },
  totals: { alignItems: 'flex-end' },
  copy: { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  copyText: { color: colors.primaryStrong, fontWeight: '800' },
  feedback: { minHeight: 100, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primary: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, flex: 1, justifyContent: 'center', minHeight: 50, padding: spacing.md },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  secondary: { alignItems: 'center', borderColor: colors.primary, borderRadius: radius.md, borderWidth: 2, flex: 1, justifyContent: 'center', minHeight: 50, padding: spacing.md },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  saved: { alignItems: 'center', backgroundColor: '#1E8A5A', borderRadius: radius.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  savedText: { color: colors.white, flex: 1, fontWeight: '900' },
  next: { backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  nextText: { color: '#1E8A5A', fontWeight: '900' },
  backdrop: { backgroundColor: colors.backdrop, flex: 1, justifyContent: 'center', padding: spacing.lg },
  modal: { backgroundColor: colors.surface, borderRadius: radius.lg, gap: spacing.sm, padding: spacing.lg },
  theirs: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, gap: 4, padding: spacing.md },
  /** En el diálogo los botones van apilados: sin `flex: 1` (en columna los recortaba). */
  modalButton: { flex: 0 },
  link: { alignItems: 'center', padding: spacing.sm },
  aiCard: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, gap: spacing.sm, padding: spacing.md },
  aiBody: { gap: spacing.sm },
  aiRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  aiMark: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: 10, color: colors.primaryStrong, fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  likelihood: { backgroundColor: colors.accentSoft, borderRadius: radius.md, gap: 4, padding: spacing.sm },
  likelihoodNote: { color: colors.accentText, fontSize: 13, fontStyle: 'italic' },
  linkText: { color: colors.primary, fontWeight: '800' },
});
