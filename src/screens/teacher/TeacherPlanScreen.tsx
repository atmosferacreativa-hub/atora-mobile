import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ApiError } from '../../api/client';
import { getSessionUserId } from '../../api/session';
import { createPlan, fetchPlan, keepPickedFile, previewPlan, publishPlan, savePlan, sqlitePlanDraftStore, uploadPlanFile } from '../../api/teacherPlans';
import { newEventId } from '../../offline/outbox/runtime';
import { useNetworkState } from '../../hooks/useNetworkState';
import { KeyboardScroll } from '../../components/KeyboardScroll';
import {
  PLAN_STEPS,
  addPendingFile,
  canPublishContent,
  draftKey,
  emptyPlan,
  normalizePlan,
  pendingUploads,
  recoverPlanDraft,
  removeResource,
  resourceTypeFor,
  sameContent,
  stepFilled,
  updateResource,
  uploadPendingResources,
  type Plan,
  type PlanData,
  type PlanPreview,
  type PlanStep,
} from '../../teacher/plans';
import { colors, radius, spacing } from '../../theme';
import { t, tk } from '../../i18n';

type Props = {
  token: string;
  courseId: number;
  planId: number;
  onBack: () => void;
};

const STEP_LABELS: Record<PlanStep, string> = {
  objetivo: tk('Objetivo'),
  distancia: tk('A distancia'),
  presencial: tk('Presencial'),
  recursos: tk('Recursos'),
  evidencia: tk('Evidencia'),
  apoyo: tk('Apoyo'),
};

/**
 * 1.3.0: preparar una semana híbrida desde el teléfono en seis pasos. Lo escrito se guarda en el teléfono a cada
 * cambio y en el servidor al tocar «Guardar» (con revisión). Vista previa y publicar; el asistente prepara y no publica.
 */
export function TeacherPlanScreen({ token, courseId, planId: initialPlanId, onBack }: Props) {
  const network = useNetworkState();
  const offline = network.isConnected === false;
  const [userId, setUserId] = useState<number | null>(null);
  const [planId, setPlanId] = useState(initialPlanId);
  const [server, setServer] = useState<Plan | null>(null);
  const [data, setData] = useState<PlanData>(emptyPlan());
  const [revision, setRevision] = useState(0);
  const [createEventId, setCreateEventId] = useState(newEventId());
  const [step, setStep] = useState<PlanStep>('objetivo');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recovered, setRecovered] = useState<'' | 'fresh' | 'stale'>('');
  const [conflict, setConflict] = useState<Plan | null>(null);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const dataRef = useRef(data);
  dataRef.current = data;

  // Cargar: plan del servidor (si existe) y borrador del teléfono.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const uid = await getSessionUserId();
      let plan: Plan | null = null;
      let loadError = '';
      if (initialPlanId > 0) {
        try {
          plan = await fetchPlan(token, initialPlanId);
        } catch (reason) {
          loadError = reason instanceof Error && reason.message ? reason.message : t('No pudimos cargar la planificación.');
        }
      }
      const draft = uid ? await sqlitePlanDraftStore.get(uid, draftKey(initialPlanId, courseId)).catch(() => null) : null;
      if (!alive) return;
      setUserId(uid);
      setServer(plan);
      const recovery = recoverPlanDraft(draft, plan);
      if (recovery) {
        setData(normalizePlan(recovery.draft.data));
        setRevision(recovery.draft.revision);
        if (recovery.draft.createEventId) setCreateEventId(recovery.draft.createEventId);
        setRecovered(recovery.stale ? 'stale' : 'fresh');
      } else if (plan) {
        setData(normalizePlan(plan.data));
        setRevision(plan.revision);
      }
      if (loadError && !recovery) setMessage(loadError);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [token, courseId, initialPlanId]);

  const persistDraft = async (next: PlanData, id = planId, rev = revision) => {
    if (!userId) return;
    await sqlitePlanDraftStore.set(userId, draftKey(id, courseId), { planId: id, courseId, revision: rev, createEventId, data: next, savedAt: Date.now() }).catch(() => undefined);
  };

  const change = (next: PlanData) => {
    setData(next);
    setPreview(null);
    void persistDraft(next);
  };

  const dirty = !server || !server.data || !sameContent(normalizePlan(server.data), data);
  const canPublish = server ? server.can_publish : true;
  const evidenceLocked = !!server?.evidence_locked;

  const uploadAll = async (only?: string): Promise<PlanData> => {
    return uploadPendingResources(dataRef.current, (file) => uploadPlanFile(token, file), (next) => {
      setData(next);
      void persistDraft(next);
    }, only);
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*', 'application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (result.canceled) return;
    let next = dataRef.current;
    for (const asset of result.assets) {
      if (!resourceTypeFor(asset.name)) {
        setMessage(t('"{name}" no tiene un formato admitido. Sube audio (MP3, M4A u OGG), PDF o imagen.', { name: asset.name }));
        continue;
      }
      const clientUploadId = newEventId();
      const kept = keepPickedFile(clientUploadId, asset.uri, asset.name);
      next = addPendingFile(next, { uri: kept.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: kept.size || asset.size || 0 }, clientUploadId);
    }
    change(next);
    if (!offline) await uploadAll();
  };

  const addLink = () => {
    if (!linkUrl.trim()) return;
    change({ ...data, resources: [...data.resources, { type: 'link', title: linkTitle.trim() || linkUrl.trim(), description: '', url: linkUrl.trim(), file_id: 0, transcript: '' }] });
    setLinkTitle('');
    setLinkUrl('');
  };

  const save = async (useRevision = revision): Promise<Plan | null> => {
    setBusy(true);
    setMessage('');
    setConflict(null);
    try {
      let current = dataRef.current;
      if (pendingUploads(current).length) {
        current = await uploadAll();
        if (pendingUploads(current).length) setMessage(t('Algunos archivos no se subieron. Se guardó el resto; reinténtalos en Recursos.'));
      }
      const saved = planId > 0 ? await savePlan(token, planId, current, useRevision) : await createPlan(token, courseId, current, createEventId);
      if (userId) {
        await sqlitePlanDraftStore.remove(userId, draftKey(planId, courseId)).catch(() => undefined);
        if (planId === 0) await sqlitePlanDraftStore.remove(userId, draftKey(0, courseId)).catch(() => undefined);
      }
      const merged = { ...normalizePlan(saved.data), resources: [...normalizePlan(saved.data).resources, ...pendingUploads(current)] };
      setServer(saved);
      setPlanId(saved.id);
      setRevision(saved.revision);
      setData(merged);
      if (pendingUploads(merged).length) void persistDraft(merged, saved.id, saved.revision);
      setRecovered('');
      if (!pendingUploads(current).length) setMessage(t('Planificación guardada.'));
      return saved;
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409 && reason.code === 'atora_plan_conflict') {
        const current = reason.data?.current as Plan | undefined;
        setConflict(current ?? null);
        setMessage(t('Otra persona guardó esta planificación mientras la editabas.'));
      } else {
        setMessage(reason instanceof Error && reason.message ? reason.message : t('No se pudo guardar. Inténtalo de nuevo.'));
      }
      return null;
    } finally {
      setBusy(false);
    }
  };

  const keepServerVersion = async () => {
    if (!conflict) return;
    if (userId) await sqlitePlanDraftStore.remove(userId, draftKey(planId, courseId)).catch(() => undefined);
    setServer(conflict);
    setData(normalizePlan(conflict.data));
    setRevision(conflict.revision);
    setConflict(null);
    setMessage(t('Cargamos la versión guardada en el servidor.'));
  };

  const showPreview = async () => {
    const saved = dirty ? await save() : server;
    if (!saved) return;
    setBusy(true);
    try {
      setPreview(await previewPlan(token, saved.id));
    } catch (reason) {
      setMessage(reason instanceof Error && reason.message ? reason.message : t('No se pudo cargar la vista previa.'));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!server || !preview) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await publishPlan(token, server.id, preview.revision);
      setServer(result.plan);
      setRevision(result.plan.revision);
      setPreview(null);
      setMessage(t('Publicada: {count} lección(es) para los estudiantes.', { count: result.lessons.length }));
    } catch (reason) {
      setMessage(reason instanceof Error && reason.message ? reason.message : t('No se pudo publicar. Inténtalo de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <ActivityIndicator style={styles.loading} color={colors.primary} />;

  const field = (label: string, value: string, onChange: (text: string) => void, testID: string, multiline = false) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={[styles.input, multiline && styles.area]}
        testID={testID}
      />
    </View>
  );

  return (
    <KeyboardScroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Volver')} onPress={onBack} hitSlop={12} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryStrong} />
        </Pressable>
        <Text style={styles.title} numberOfLines={2}>{data.title || t('Nueva semana')}</Text>
      </View>
      <Text style={styles.meta} testID="plan-status">
        {server ? (server.status === 'published' ? t('Publicada') : t('Borrador')) : t('Sin guardar en el servidor')}
        {dirty ? ` · ${t('cambios sin guardar')}` : ''}
      </Text>
      {recovered ? (
        <Text style={styles.note} testID="plan-recovered">
          {recovered === 'stale'
            ? t('Recuperamos lo que escribiste en el teléfono. Alguien guardó después: al guardar podrás elegir qué versión queda.')
            : t('Recuperamos lo que escribiste en el teléfono.')}
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.steps}>
        {PLAN_STEPS.map((key, index) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: step === key }}
            onPress={() => setStep(key)}
            style={[styles.step, step === key && styles.stepOn]}
            testID={`plan-step-${key}`}
          >
            <Text style={[styles.stepText, step === key && styles.stepTextOn]}>
              {index + 1}. {t(STEP_LABELS[key])}{stepFilled(data, key) ? ' ✓' : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {step === 'objetivo' ? (
        <View style={styles.panel}>
          {field(t('Título de la semana'), data.title, (text) => change({ ...data, title: text }), 'plan-title')}
          {field(t('Semana o etiqueta'), data.week_label, (text) => change({ ...data, week_label: text }), 'plan-week')}
          {field(t('Objetivo de aprendizaje'), data.objective, (text) => change({ ...data, objective: text }), 'plan-objective', true)}
        </View>
      ) : null}

      {step === 'distancia' ? (
        <View style={styles.panel}>
          {field(t('Antes del encuentro'), data.remote.before, (text) => change({ ...data, remote: { ...data.remote, before: text } }), 'plan-remote-before', true)}
          {field(t('Después del encuentro'), data.remote.after, (text) => change({ ...data, remote: { ...data.remote, after: text } }), 'plan-remote-after', true)}
        </View>
      ) : null}

      {step === 'presencial' ? (
        <View style={styles.panel}>
          {field(t('Fecha (AAAA-MM-DD)'), data.in_person.date, (text) => change({ ...data, in_person: { ...data.in_person, date: text.trim() } }), 'plan-in-person-date')}
          {field(t('Hora (HH:MM)'), data.in_person.time, (text) => change({ ...data, in_person: { ...data.in_person, time: text.trim() } }), 'plan-in-person-time')}
          {field(t('Lugar'), data.in_person.place, (text) => change({ ...data, in_person: { ...data.in_person, place: text } }), 'plan-in-person-place')}
          {field(t('Qué haremos en el aula'), data.in_person.activities, (text) => change({ ...data, in_person: { ...data.in_person, activities: text } }), 'plan-in-person-activities', true)}
        </View>
      ) : null}

      {step === 'recursos' ? (
        <View style={styles.panel}>
          {data.resources.map((resource, index) => (
            <View key={resource.local?.clientUploadId ?? `${resource.type}-${resource.file_id}-${index}`} style={styles.resource}>
              <View style={styles.resourceHead}>
                <Ionicons name={resource.type === 'audio' ? 'musical-notes-outline' : resource.type === 'link' ? 'link-outline' : 'document-outline'} size={18} color={colors.primaryStrong} />
                <Text style={styles.resourceTitle} numberOfLines={2}>{resource.title || resource.url}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('Quitar {title}', { title: resource.title })} onPress={() => change(removeResource(data, index))} style={styles.icon}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
              {resource.local?.state === 'pending' ? <Text style={styles.meta}>{offline ? t('Pendiente: se subirá con conexión.') : t('Subiendo…')}</Text> : null}
              {resource.local?.state === 'failed' ? (
                <View style={styles.failed}>
                  <Text style={styles.error}>{t('No se subió: {error}', { error: resource.local.error ?? '' })}</Text>
                  <Pressable accessibilityRole="button" disabled={offline || busy} onPress={() => void uploadAll(resource.local?.clientUploadId)} style={styles.small}>
                    <Text style={styles.smallText}>{t('Reintentar')}</Text>
                  </Pressable>
                </View>
              ) : null}
              {resource.type === 'audio'
                ? field(t('Transcripción (para quien no puede escuchar)'), resource.transcript, (text) => change(updateResource(data, index, { transcript: text })), `plan-transcript-${index}`, true)
                : null}
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => void pickFile()} style={styles.secondary} testID="plan-add-file">
            <Ionicons name="cloud-upload-outline" size={18} color={colors.primaryStrong} />
            <Text style={styles.secondaryText}>{t('Subir audio o archivo del teléfono')}</Text>
          </Pressable>
          {field(t('Título del enlace'), linkTitle, setLinkTitle, 'plan-link-title')}
          {field(t('Enlace (https://…)'), linkUrl, setLinkUrl, 'plan-link-url')}
          <Pressable accessibilityRole="button" onPress={addLink} style={styles.secondary} testID="plan-add-link">
            <Text style={styles.secondaryText}>{t('Agregar enlace')}</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'evidencia' ? (
        <View style={styles.panel}>
          {evidenceLocked ? <Text style={styles.note}>{t('La evidencia la define el docente del curso.')}</Text> : null}
          <View style={styles.switchRow}>
            <Text style={styles.label}>{t('Pedir una evidencia (tarea)')}</Text>
            <Switch
              accessibilityLabel={t('Pedir una evidencia (tarea)')}
              disabled={evidenceLocked}
              value={data.evidence.enabled}
              onValueChange={(value) => change({ ...data, evidence: { ...data.evidence, enabled: value } })}
              testID="plan-evidence-enabled"
            />
          </View>
          {data.evidence.enabled && !evidenceLocked ? (
            <>
              {field(t('Título de la evidencia'), data.evidence.title, (text) => change({ ...data, evidence: { ...data.evidence, title: text } }), 'plan-evidence-title')}
              {field(t('Qué entregar'), data.evidence.instructions, (text) => change({ ...data, evidence: { ...data.evidence, instructions: text } }), 'plan-evidence-instructions', true)}
              {field(t('Fecha de entrega (AAAA-MM-DD)'), data.evidence.due_date, (text) => change({ ...data, evidence: { ...data.evidence, due_date: text.trim() } }), 'plan-evidence-date')}
              {field(t('Criterios de evaluación'), data.evidence.criteria, (text) => change({ ...data, evidence: { ...data.evidence, criteria: text } }), 'plan-evidence-criteria', true)}
            </>
          ) : null}
        </View>
      ) : null}

      {step === 'apoyo' ? (
        <View style={styles.panel}>
          {field(t('Cómo pedir ayuda'), data.support.how, (text) => change({ ...data, support: { ...data.support, how: text } }), 'plan-support-how', true)}
          {field(t('Cuándo'), data.support.when, (text) => change({ ...data, support: { ...data.support, when: text } }), 'plan-support-when')}
        </View>
      ) : null}

      {message ? <Text accessibilityRole="alert" style={styles.message} testID="plan-message">{message}</Text> : null}
      {conflict ? (
        <View style={styles.conflict}>
          <Pressable accessibilityRole="button" onPress={() => void keepServerVersion()} style={styles.secondary}>
            <Text style={styles.secondaryText}>{t('Ver la versión del servidor')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void save(conflict.revision)} style={styles.secondary}>
            <Text style={styles.secondaryText}>{t('Reemplazar con la mía')}</Text>
          </Pressable>
        </View>
      ) : null}

      {offline ? <Text style={styles.meta}>{t('Sin conexión: lo que escribes queda en el teléfono. Guardar y publicar necesitan conexión.')}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy || offline} onPress={() => void save()} style={[styles.primary, (busy || offline) && styles.disabled]} testID="plan-save">
        <Text style={styles.primaryText}>{busy ? t('Guardando…') : t('Guardar')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy || offline || !canPublishContent(data)} onPress={() => void showPreview()} style={[styles.secondary, (busy || offline || !canPublishContent(data)) && styles.disabled]} testID="plan-preview">
        <Text style={styles.secondaryText}>{t('Vista previa')}</Text>
      </Pressable>
      {!canPublishContent(data) ? <Text style={styles.meta}>{t('Para publicar, completa el trabajo a distancia, el encuentro o la evidencia.')}</Text> : null}

      {preview ? (
        <View style={styles.preview} testID="plan-preview-list">
          <Text style={styles.label}>{t('Lo que verán los estudiantes')}</Text>
          {preview.items.map((item) => (
            <Text key={item.key} style={styles.previewItem}>
              {item.action === 'create' ? t('Nueva') : item.action === 'update' ? t('Se actualiza') : t('Se mantiene')} · {item.title}
            </Text>
          ))}
          {canPublish ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void publish()} style={styles.primary} testID="plan-publish">
              <Text style={styles.primaryText}>{t('Publicar para los estudiantes')}</Text>
            </Pressable>
          ) : (
            <Text style={styles.note}>{t('Solo el docente del curso puede publicar. Queda preparada.')}</Text>
          )}
        </View>
      ) : null}
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xl },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  back: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, flex: 1, fontSize: 22, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 13 },
  note: { backgroundColor: colors.accentSoft, borderRadius: radius.md, color: colors.accentText, padding: spacing.sm },
  steps: { gap: spacing.xs },
  step: { alignItems: 'center', borderColor: colors.line, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  stepOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepText: { color: colors.text, fontWeight: '700' },
  stepTextOn: { color: colors.white },
  panel: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  field: { gap: 4 },
  label: { color: colors.text, fontWeight: '800' },
  input: { borderColor: colors.line, borderRadius: radius.sm, borderWidth: 1, color: colors.text, minHeight: 44, paddingHorizontal: spacing.sm },
  area: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: 'top' },
  resource: { borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.sm },
  resourceHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  resourceTitle: { color: colors.text, flex: 1, fontWeight: '700' },
  icon: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  failed: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  small: { alignItems: 'center', borderColor: colors.primary, borderRadius: radius.sm, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  smallText: { color: colors.primary, fontWeight: '800' },
  error: { color: colors.danger, flex: 1 },
  switchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
  message: { color: colors.text },
  conflict: { gap: spacing.sm },
  primary: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, justifyContent: 'center', minHeight: 48 },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondary: { alignItems: 'center', borderColor: colors.primary, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.sm },
  secondaryText: { color: colors.primaryStrong, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  preview: { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  previewItem: { color: colors.text },
});
