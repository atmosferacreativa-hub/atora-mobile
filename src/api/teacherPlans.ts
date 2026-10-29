import { authenticatedRequest } from './authenticated';
import { getSessionUserId } from './session';
import { cacheDelete, cacheGet, cacheSet } from '../offline/localCache';
import { copyAttachment } from '../offline/outboxFiles';
import { forServer, type Plan, type PlanData, type PlanDraft, type PlanDraftStore, type PlanList, type PlanPreview, type PlanResource, type UploadedMedia } from '../teacher/plans';

/**
 * 1.3.0 (plugin 6.40.0): planificación híbrida desde la app. Guardar y publicar necesitan conexión; lo escrito queda en
 * el teléfono (borrador local) hasta que el servidor lo confirma.
 */
export function fetchPlans(token: string, courseId: number): Promise<PlanList> {
  return authenticatedRequest<PlanList>(`teacher/plans?course=${courseId}`, { token });
}

export function fetchPlan(token: string, planId: number): Promise<Plan> {
  return authenticatedRequest<Plan>(`teacher/plans/${planId}`, { token });
}

/** Crear: el client_event_id hace que un reintento devuelva el mismo plan. */
export function createPlan(token: string, courseId: number, data: PlanData, eventId: string): Promise<Plan> {
  return authenticatedRequest<Plan>('teacher/plans', {
    method: 'POST',
    token,
    body: JSON.stringify({ course_id: courseId, client_event_id: eventId, data: forServer(data) }),
  });
}

/** Guardar con la revisión con la que se empezó: si otra persona guardó, el servidor responde 409. */
export function savePlan(token: string, planId: number, data: PlanData, revision: number): Promise<Plan> {
  return authenticatedRequest<Plan>(`teacher/plans/${planId}`, {
    method: 'POST',
    token,
    body: JSON.stringify({ data: forServer(data), revision }),
  });
}

export function previewPlan(token: string, planId: number): Promise<PlanPreview> {
  return authenticatedRequest<PlanPreview>(`teacher/plans/${planId}/preview`, { token });
}

export function publishPlan(token: string, planId: number, revision: number): Promise<{ plan: Plan; lessons: { key: string; title: string; lesson_id: number }[] }> {
  return authenticatedRequest(`teacher/plans/${planId}/publish`, { method: 'POST', token, body: JSON.stringify({ revision }) });
}

/** Copia el archivo elegido al almacenamiento privado de la app: sigue ahí para reintentar aunque se cierre la app. */
export function keepPickedFile(clientUploadId: string, uri: string, name: string): { uri: string; size: number } {
  return copyAttachment(`plan-${clientUploadId}`, 0, uri, name);
}

/** Sube un archivo del teléfono. El mismo client_upload_id devuelve el mismo adjunto (sin duplicar). */
export function uploadPlanFile(token: string, file: NonNullable<PlanResource['local']>): Promise<UploadedMedia> {
  const form = new FormData();
  form.append('client_upload_id', file.clientUploadId);
  // React Native acepta {uri, name, type} como parte de archivo.
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
  return authenticatedRequest<UploadedMedia>('teacher/media', { method: 'POST', token, body: form, timeoutMs: 120_000 });
}

/** Borradores de planificación en la base local (se borra entera al cerrar sesión). */
export const sqlitePlanDraftStore: PlanDraftStore = {
  get: (userId, key) => cacheGet<PlanDraft>(userId, 'teacher_plan_draft', key),
  set: (userId, key, draft) => cacheSet(userId, 'teacher_plan_draft', key, draft),
  remove: (userId, key) => cacheDelete(userId, 'teacher_plan_draft', key),
};

