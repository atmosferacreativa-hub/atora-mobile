import {
  addPendingFile,
  canPublishContent,
  draftKey,
  emptyPlan,
  forServer,
  normalizePlan,
  recoverPlanDraft,
  resourceTypeFor,
  stepFilled,
  uploadPendingResources,
  type Plan,
  type PlanData,
  type PlanDraft,
  type UploadedMedia,
} from '../plans';

const audio = { uri: 'file:///app/clase.m4a', name: 'clase.m4a', mimeType: 'audio/mp4', size: 2048 };
const media = (id: number): UploadedMedia => ({ id, type: 'audio', title: 'clase', mime: 'audio/mp4', bytes: 2048, duration_seconds: 12, url: 'https://x/clase.m4a' });

describe('planificación híbrida', () => {
  it('publicar exige distancia, encuentro o evidencia (como el servidor)', () => {
    const plan = emptyPlan();
    expect(canPublishContent({ ...plan, title: 'Semana 1', objective: 'Algo' })).toBe(false);
    expect(canPublishContent({ ...plan, remote: { before: 'Leer', after: '' } })).toBe(true);
    expect(canPublishContent({ ...plan, in_person: { ...plan.in_person, date: '2026-11-10' } })).toBe(true);
    expect(canPublishContent({ ...plan, evidence: { ...plan.evidence, enabled: true } })).toBe(false);
    expect(canPublishContent({ ...plan, evidence: { ...plan.evidence, enabled: true, title: 'Ensayo' } })).toBe(true);
    // Un audio que aún no subió no cuenta.
    expect(canPublishContent(addPendingFile(plan, audio, 'u-1'))).toBe(false);
  });

  it('marca los pasos con contenido', () => {
    const plan = { ...emptyPlan(), objective: 'Fracciones', support: { how: '', when: 'Martes' } };
    expect(stepFilled(plan, 'objetivo')).toBe(true);
    expect(stepFilled(plan, 'apoyo')).toBe(true);
    expect(stepFilled(plan, 'distancia')).toBe(false);
  });

  it('solo admite audio MP3/M4A/OGG, PDF e imagen', () => {
    expect(resourceTypeFor('Clase.M4A')).toBe('audio');
    expect(resourceTypeFor('guia.pdf')).toBe('pdf');
    expect(resourceTypeFor('foto.png')).toBe('archivo');
    expect(resourceTypeFor('nota.wav')).toBeNull();
    expect(addPendingFile(emptyPlan(), { ...audio, name: 'nota.wav' }, 'u-1').resources).toHaveLength(0);
  });

  it('lo pendiente no se envía al servidor', () => {
    const plan = addPendingFile({ ...emptyPlan(), resources: [{ type: 'link', title: 'Web', description: '', url: 'https://a', file_id: 0, transcript: '' }] }, audio, 'u-1');
    expect(forServer(plan).resources).toEqual([{ type: 'link', title: 'Web', description: '', url: 'https://a', file_id: 0, transcript: '' }]);
  });

  it('un fallo queda para reintentar con el mismo client_upload_id; el reintento no duplica', async () => {
    let plan: PlanData = addPendingFile(emptyPlan(), audio, 'u-1');
    plan = { ...plan, resources: plan.resources.map((r) => ({ ...r, transcript: 'Hola' })) };
    const ids: string[] = [];
    const states: string[] = [];
    let fail = true;
    const upload = async (file: { clientUploadId: string }) => {
      ids.push(file.clientUploadId);
      if (fail) throw new Error('Sin conexión');
      return media(77);
    };
    const track = (next: PlanData) => {
      states.push(next.resources[0]?.local?.state ?? 'ok');
    };

    plan = await uploadPendingResources(plan, upload, track);
    expect(plan.resources[0]?.local).toMatchObject({ state: 'failed', error: 'Sin conexión' });

    fail = false;
    plan = await uploadPendingResources(plan, upload, track);
    expect(ids).toEqual(['u-1', 'u-1']);
    expect(states).toEqual(['pending', 'failed', 'pending', 'ok']);
    expect(plan.resources).toEqual([{ type: 'audio', title: 'clase', description: '', url: '', file_id: 77, transcript: 'Hola' }]);
    expect(canPublishContent(plan)).toBe(true);

    // Ya subido: no se vuelve a subir.
    await uploadPendingResources(plan, upload, track);
    expect(ids).toHaveLength(2);
  });

  it('borrador local: se ofrece si difiere del servidor y avisa si alguien guardó después', () => {
    const server: Plan = { id: 5, course_id: 9, title: 'S1', status: 'draft', revision: 3, published_revision: null, has_unpublished_changes: false, updated_at: null, can_publish: true, data: normalizePlan({ title: 'S1' }) };
    const draft: PlanDraft = { planId: 5, courseId: 9, revision: 2, createEventId: 'c', data: normalizePlan({ title: 'S1', objective: 'Nuevo' }), savedAt: 1 };
    expect(recoverPlanDraft(draft, server)).toEqual({ draft, stale: true });
    expect(recoverPlanDraft({ ...draft, revision: 3 }, server)).toEqual({ draft: { ...draft, revision: 3 }, stale: false });
    expect(recoverPlanDraft({ ...draft, data: normalizePlan({ title: 'S1' }) }, server)).toBeNull();
    expect(recoverPlanDraft(null, server)).toBeNull();
    expect(draftKey(0, 9)).toBe(-9);
    expect(draftKey(5, 9)).toBe(5);
  });

  it('normaliza lo que falte en un plan del servidor', () => {
    const plan = normalizePlan({ title: 'X', in_person: { date: '2026-11-10' } as PlanData['in_person'] });
    expect(plan.in_person).toEqual({ date: '2026-11-10', time: '', place: '', activities: '' });
    expect(plan.evidence.enabled).toBe(false);
  });
});
