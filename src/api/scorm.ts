import { ApiError, apiRequest } from './client';
import { enqueueEvent, newEventId, OutboxDefinitiveError, registerOutboxHandler } from '../offline/outbox/runtime';
import { buildScormCommitBody, type ScormCommitOutboxPayload } from '../scorm/outboxCommitHandler';

export type ScormStartAttemptResponse = {
  attempt_id: number;
  lesson_id: number;
  wp_lesson_id: number;
  library_item_id: number;
  library_version_id: number;
  version_checksum_sha256: string;
  scorm_version: string;
  launch_href: string;
  sco_hrefs: string[];
  download_url: string;
  download_expires_at: string;
  download_bytes: number;
};

export type ScormDownloadLinkResponse = {
  attempt_id: number;
  library_version_id: number;
  version_checksum_sha256: string;
  scorm_version: string;
  download_url: string;
  download_expires_at: string;
  download_bytes: number;
};

export type ScormValuesResponse = { values: Record<string, string> };

export async function startScormAttempt(token: string, lessonId: number, libraryItemId: number): Promise<ScormStartAttemptResponse> {
  return apiRequest<ScormStartAttemptResponse>('scorm/attempts/start', {
    method: 'POST',
    token,
    body: JSON.stringify({ lesson_id: lessonId, library_item_id: libraryItemId }),
  });
}

export async function scormDownloadLink(token: string, lessonId: number, libraryItemId: number): Promise<ScormDownloadLinkResponse> {
  return apiRequest<ScormDownloadLinkResponse>('scorm/packages/link', {
    method: 'POST',
    token,
    body: JSON.stringify({ lesson_id: lessonId, library_item_id: libraryItemId }),
  });
}

export async function scormGetValues(token: string, attemptId: number): Promise<ScormValuesResponse> {
  return apiRequest<ScormValuesResponse>(`scorm/attempts/${attemptId}/values`, { method: 'GET', token });
}

export async function scormCommit(
  token: string,
  attemptId: number,
  payload: { values: Record<string, string>; client_event_id: string; device_time: string },
): Promise<unknown> {
  return apiRequest(`scorm/attempts/${attemptId}/commit`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export const SCORM_COMMIT = 'scorm.commit';
export type ScormCommitPayload = ScormCommitOutboxPayload;

registerOutboxHandler<ScormCommitPayload>(SCORM_COMMIT, async (event, { token }) => {
  const payload = event.payload as ScormCommitPayload;
  if (!payload?.attemptId) throw new OutboxDefinitiveError('Falta attemptId');
  await scormCommit(token, payload.attemptId, buildScormCommitBody(event as any));
});

export async function enqueueScormCommit(attemptId: number, values: Record<string, string>): Promise<string | null> {
  const id = newEventId();
  const event = await enqueueEvent<ScormCommitPayload>({
    id,
    type: SCORM_COMMIT,
    dedupeKey: `${SCORM_COMMIT}:${attemptId}:${id}`,
    payload: { attemptId, values, deviceTime: new Date().toISOString() },
  });
  return event ? event.id : null;
}

export function isScormNoAttemptsError(reason: unknown): boolean {
  return reason instanceof ApiError && reason.status === 409 && reason.code === 'atora_scorm_no_attempts';
}

