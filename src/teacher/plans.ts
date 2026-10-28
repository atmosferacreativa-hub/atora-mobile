/**
 * 1.3.0 (plugin 6.40.0): planificación híbrida desde el teléfono. Módulo puro, para Jest.
 *
 * - El docente escribe en seis pasos. Lo escrito se guarda en el teléfono a cada cambio (borrador local) y en el
 *   servidor al tocar «Guardar» (con la revisión: si otra persona guardó antes, 409 y no se pisa).
 * - Un audio del teléfono se sube con un `client_upload_id` fijo desde que se elige: reintentar tras un corte devuelve
 *   el mismo archivo en el servidor, no otro. Mientras no llegó, el recurso queda «pendiente» o «falló» y no se envía.
 */

export type PlanResource = {
  type: 'link' | 'archivo' | 'pdf' | 'audio' | 'video';
  title: string;
  description: string;
  url: string;
  file_id: number;
  transcript: string;
  /** Solo en el teléfono: subida en curso o fallida. */
  local?: { clientUploadId: string; uri: string; name: string; mimeType: string; size: number; state: 'pending' | 'failed'; error?: string };
};

export type PlanData = {
  title: string;
  week_label: string;
  objective: string;
  in_person: { date: string; time: string; place: string; activities: string };
  remote: { before: string; after: string };
  resources: PlanResource[];
  evidence: { enabled: boolean; title: string; instructions: string; due_date: string; due_time: string; rubric_id: number; criteria: string };
  support: { how: string; when: string };
};

export type Plan = {
  id: number;
  course_id: number;
  title: string;
  status: 'draft' | 'published' | string;
  revision: number;
  published_revision: number | null;
  has_unpublished_changes: boolean;
  updated_at: string | null;
  can_publish: boolean;
  evidence_locked?: boolean;
  data?: PlanData;
};

export type PlanList = { plans: Plan[]; can_edit: boolean; can_publish: boolean; ai_available: boolean; empty: PlanData };

export type PlanPreviewItem = { key: string; title: string; action: string; content?: string };
export type PlanPreview = { plan_id: number; revision: number; can_publish: boolean; items: PlanPreviewItem[] };

export type UploadedMedia = { id: number; type: 'audio' | 'pdf' | 'archivo'; title: string; mime: string; bytes: number | null; duration_seconds: number | null; url: string };

export const PLAN_STEPS = ['objetivo', 'distancia', 'presencial', 'recursos', 'evidencia', 'apoyo'] as const;
export type PlanStep = (typeof PLAN_STEPS)[number];

export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'ogg'];
export const DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

const BLANK_RESOURCE: PlanResource = { type: 'link', title: '', description: '', url: '', file_id: 0, transcript: '' };

export function emptyPlan(): PlanData {
  return {
    title: '',
    week_label: '',
    objective: '',
    in_person: { date: '', time: '', place: '', activities: '' },
    remote: { before: '', after: '' },
    resources: [],
    evidence: { enabled: false, title: '', instructions: '', due_date: '', due_time: '', rubric_id: 0, criteria: '' },
    support: { how: '', when: '' },
  };
}

/** Completa con lo vacío lo que el servidor o un borrador viejo no traiga. */
export function normalizePlan(raw: Partial<PlanData> | null | undefined): PlanData {
  const base = emptyPlan();
  const data = raw ?? {};
  return {
    ...base,
    ...data,
    in_person: { ...base.in_person, ...(data.in_person ?? {}) },
    remote: { ...base.remote, ...(data.remote ?? {}) },
    resources: Array.isArray(data.resources) ? data.resources.map((r) => ({ ...BLANK_RESOURCE, ...(r as Partial<PlanResource>) })) : [],
    evidence: { ...base.evidence, ...(data.evidence ?? {}) },
    support: { ...base.support, ...(data.support ?? {}) },
  };
}

/** ¿El paso tiene algo escrito? (para marcarlo en la barra de pasos). */
export function stepFilled(data: PlanData, step: PlanStep): boolean {
  switch (step) {
    case 'objetivo':
      return data.title.trim() !== '' || data.objective.trim() !== '';
    case 'distancia':
      return data.remote.before.trim() !== '' || data.remote.after.trim() !== '';
    case 'presencial':
      return data.in_person.date !== '' || data.in_person.activities.trim() !== '';
    case 'recursos':
      return data.resources.length > 0;
    case 'evidencia':
      return data.evidence.enabled && (data.evidence.title.trim() !== '' || data.evidence.instructions.trim() !== '');
    case 'apoyo':
      return data.support.how.trim() !== '' || data.support.when.trim() !== '';
  }
}

/** Misma regla que el servidor: publicar exige trabajo a distancia, encuentro o evidencia. */
export function canPublishContent(data: PlanData): boolean {
  const sent = forServer(data);
  return (
    sent.remote.before.trim() !== '' ||
    sent.remote.after.trim() !== '' ||
    sent.resources.length > 0 ||
    sent.in_person.activities.trim() !== '' ||
    sent.in_person.date !== '' ||
    stepFilled(sent, 'evidencia')
  );
}

/** Lo que se envía: sin los recursos que aún no llegaron al servidor ni los datos locales de la subida. */
export function forServer(data: PlanData): PlanData {
  return {
    ...data,
    resources: data.resources.filter((r) => !r.local).map(({ local: _local, ...rest }) => rest),
  };
}

export function pendingUploads(data: PlanData): PlanResource[] {
  return data.resources.filter((r) => r.local);
}

export function fileExtension(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  return match ? match[1]!.toLowerCase() : '';
}

/** Tipo de recurso según la extensión, o null si el servidor no lo admite. */
export function resourceTypeFor(name: string): PlanResource['type'] | null {
  const ext = fileExtension(name);
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (DOC_EXTENSIONS.includes(ext)) return 'archivo';
  return null;
}

/** Agrega el archivo elegido como recurso pendiente (su `client_upload_id` ya no cambia). */
export function addPendingFile(
  data: PlanData,
  file: { uri: string; name: string; mimeType: string; size: number },
  clientUploadId: string,
): PlanData {
  const type = resourceTypeFor(file.name);
  if (!type) return data;
  const title = file.name.replace(/\.[^.]+$/, '');
  const resource: PlanResource = {
    type,
    title,
    description: '',
    url: '',
    file_id: 0,
    transcript: '',
    local: { clientUploadId, uri: file.uri, name: file.name, mimeType: file.mimeType, size: file.size, state: 'pending' },
  };
  return { ...data, resources: [...data.resources, resource] };
}

/** La subida llegó: el recurso queda con el id del servidor (lo escrito por el docente se conserva). */
export function markUploaded(data: PlanData, clientUploadId: string, media: UploadedMedia): PlanData {
  return {
    ...data,
    resources: data.resources.map((r) => {
      if (r.local?.clientUploadId !== clientUploadId) return r;
      const { local: _local, ...rest } = r;
      return { ...rest, file_id: media.id, title: rest.title || media.title };
    }),
  };
}

export function markUploadFailed(data: PlanData, clientUploadId: string, error: string): PlanData {
  return {
    ...data,
    resources: data.resources.map((r) => (r.local?.clientUploadId === clientUploadId ? { ...r, local: { ...r.local, state: 'failed', error } } : r)),
  };
}

export function markUploadPending(data: PlanData, clientUploadId: string): PlanData {
  return {
    ...data,
    resources: data.resources.map((r) => (r.local?.clientUploadId === clientUploadId ? { ...r, local: { ...r.local, state: 'pending', error: undefined } } : r)),
  };
}

export function removeResource(data: PlanData, index: number): PlanData {
  return { ...data, resources: data.resources.filter((_, i) => i !== index) };
}

export function updateResource(data: PlanData, index: number, patch: Partial<PlanResource>): PlanData {
  return { ...data, resources: data.resources.map((r, i) => (i === index ? { ...r, ...patch } : r)) };
}

// ── Borrador local ──────────────────────────────────────────────────────

export type PlanDraft = {
  /** 0 mientras el plan no existe en el servidor. */
  planId: number;
  courseId: number;
  /** Revisión del servidor cuando se empezó a editar (para el 409). */
  revision: number;
  /** client_event_id de la creación: un reintento no crea otro plan. */
  createEventId: string;
  data: PlanData;
  savedAt: number;
};

export interface PlanDraftStore {
  get(userId: number, key: number): Promise<PlanDraft | null>;
  set(userId: number, key: number, draft: PlanDraft): Promise<void>;
  remove(userId: number, key: number): Promise<void>;
}

/** Clave del borrador: el id del plan, o (negativo) el curso para una planificación nueva. */
export function draftKey(planId: number, courseId: number): number {
  return planId > 0 ? planId : -courseId;
}

export function sameContent(a: PlanData, b: PlanData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Al abrir: si hay borrador local con cambios respecto del servidor, se ofrece. `stale` avisa que alguien guardó en
 * el servidor después de empezarlo (al guardar vendrá el 409).
 */
export function recoverPlanDraft(draft: PlanDraft | null, server: Plan | null): { draft: PlanDraft; stale: boolean } | null {
  if (!draft) return null;
  if (server && server.data && sameContent(normalizePlan(draft.data), normalizePlan(server.data))) return null;
  return { draft, stale: !!server && server.revision > draft.revision };
}

/**
 * Sube los recursos pendientes o fallidos, uno a uno, con su `client_upload_id` de siempre. Un error deja ese recurso
 * «falló» (se puede reintentar) y sigue con los demás. Devuelve el plan con lo que llegó.
 */
export async function uploadPendingResources(
  data: PlanData,
  upload: (file: NonNullable<PlanResource['local']>) => Promise<UploadedMedia>,
  onChange: (next: PlanData) => void | Promise<void>,
  only?: string,
): Promise<PlanData> {
  let current = data;
  for (const resource of data.resources) {
    const local = resource.local;
    if (!local || (only && local.clientUploadId !== only)) continue;
    current = markUploadPending(current, local.clientUploadId);
    await onChange(current);
    try {
      const media = await upload(local);
      current = markUploaded(current, local.clientUploadId, media);
    } catch (reason) {
      current = markUploadFailed(current, local.clientUploadId, reason instanceof Error ? reason.message : String(reason));
    }
    await onChange(current);
  }
  return current;
}
