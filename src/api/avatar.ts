import { authenticatedRequest } from './authenticated';
import { newEventId } from '../offline/outbox/runtime';

/** 1.4.0 (plugin 6.41.0): foto de perfil del usuario. Necesita conexión. */
export type AvatarResult = { avatar_id: number; avatar_url: string };

export function uploadAvatar(token: string, file: { uri: string; mimeType: string; name: string }, clientUploadId: string = newEventId()): Promise<AvatarResult> {
  const form = new FormData();
  form.append('client_upload_id', clientUploadId);
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  return authenticatedRequest<AvatarResult>('me/avatar', { method: 'POST', token, body: form, timeoutMs: 120_000 });
}

export function removeAvatar(token: string): Promise<{ deleted: boolean }> {
  return authenticatedRequest<{ deleted: boolean }>('me/avatar', { method: 'DELETE', token });
}
