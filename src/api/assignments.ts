import * as Network from 'expo-network';
import { ApiError, isRetriableError } from './client';
import { authenticatedRequest } from './authenticated';
import { getSessionUserId } from './session';
import { cacheGet, cacheSet } from '../offline/localCache';
import { getDownloadSettings } from '../offline/mediaDownloads';
import { copyAttachment, deleteEventFiles, fileExists, readRange } from '../offline/outboxFiles';
import { OutboxDefinitiveError, enqueueEvent, newEventId, registerOutboxHandler } from '../offline/outbox/runtime';
import type { AssignmentInfo, AssignmentResponse, AssignmentSubmission } from '../types';

/** Contrato: docs/CONTRATO-ENTREGAS-MOVIL.md del plugin (6.27.0). */
export const ASSIGNMENT_SUBMISSION = 'assignment_submission';
const CHUNK_SIZE = 1024 * 1024;

export type DraftFile = {
  /** Copia privada en el almacenamiento de la app. */
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  uploadToken?: string;
  received?: number;
  chunkSize?: number;
  completed?: boolean;
};

export type AssignmentDraft = {
  lessonId: number;
  bodyText: string;
  /** ISO 8601: el momento en que el estudiante la hizo. */
  clientSubmittedAt: string;
  files: DraftFile[];
};

export type PickedFile = { uri: string; name: string; mimeType: string; size: number };

export async function fetchAssignment(lessonId: number, token: string): Promise<AssignmentResponse> {
  const userId = await getSessionUserId();
  try {
    const data = await authenticatedRequest<AssignmentResponse>(`assignments/${lessonId}`, { token });
    if (userId) await cacheSet(userId, 'assignment', lessonId, data).catch(() => undefined);
    return data;
  } catch (reason) {
    if (reason instanceof ApiError && !isRetriableError(reason)) throw reason;
    const cached = userId ? await cacheGet<AssignmentResponse>(userId, 'assignment', lessonId).catch(() => null) : null;
    if (!cached) throw reason;
    return cached;
  }
}

/** 0.4.1: para la sincronización: lanza si falla (sin caer a la caché). */
export async function refreshAssignment(lessonId: number, token: string): Promise<AssignmentResponse> {
  const data = await authenticatedRequest<AssignmentResponse>(`assignments/${lessonId}`, { token });
  const userId = await getSessionUserId();
  if (userId) await cacheSet(userId, 'assignment', lessonId, data);
  return data;
}

/** Valida contra lo que informa el servidor, antes de encolar. Devuelve el motivo del rechazo o null. */
export function validateAttachments(accepted: AssignmentInfo['accepted_files'], files: PickedFile[]): string | null {
  if (files.length > accepted.max_files) {
    return `Puedes adjuntar hasta ${accepted.max_files} archivo(s).`;
  }
  for (const file of files) {
    const extension = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!accepted.extensions.includes(extension)) {
      return `"${file.name}" no tiene un formato permitido (${accepted.extensions.join(', ')}).`;
    }
    if (file.size > accepted.max_bytes) {
      return `"${file.name}" supera el máximo de ${(accepted.max_bytes / (1024 * 1024)).toFixed(0)} MB.`;
    }
  }
  return null;
}

/**
 * Guarda la entrega en la cola con su client_event_id y la hora del momento.
 * Los adjuntos se copian al almacenamiento privado de la app.
 */
export async function enqueueAssignmentSubmission(
  lessonId: number,
  bodyText: string,
  picked: PickedFile[],
): Promise<{ eventId: string; clientSubmittedAt: string }> {
  const eventId = newEventId();
  const clientSubmittedAt = new Date().toISOString();
  try {
    const files: DraftFile[] = picked.map((file, index) => {
      const copy = copyAttachment(eventId, index, file.uri, file.name);
      return { uri: copy.uri, name: file.name, mimeType: file.mimeType, size: copy.size || file.size };
    });
    const draft: AssignmentDraft = { lessonId, bodyText, clientSubmittedAt, files };
    const event = await enqueueEvent({ id: eventId, type: ASSIGNMENT_SUBMISSION, dedupeKey: eventId, payload: draft });
    if (!event) throw new Error('Sin sesión activa.');
    return { eventId, clientSubmittedAt };
  } catch (reason) {
    deleteEventFiles(eventId);
    throw reason;
  }
}

// ── Envío (manejador de la cola) ─────────────────────────────────────────

async function ensureUploadNetwork(draft: AssignmentDraft): Promise<void> {
  if (draft.files.every((file) => file.completed)) return;
  const settings = await getDownloadSettings();
  if (!settings.wifiOnly) return;
  const network = await Network.getNetworkStateAsync();
  if (network.type !== Network.NetworkStateType.WIFI) {
    // Reintentable: se enviará al conectarse a Wi-Fi.
    throw new ApiError('Esperando Wi-Fi para subir los adjuntos.', 0, 'waiting_wifi');
  }
}

async function uploadFile(
  draft: AssignmentDraft,
  index: number,
  token: string,
  save: (draft: AssignmentDraft) => Promise<void>,
): Promise<void> {
  const persist = async (file: DraftFile) => {
    draft.files[index] = file;
    await save(draft);
  };
  let file = draft.files[index]!;
  if (file.completed) return;
  if (!fileExists(file.uri)) {
    throw new OutboxDefinitiveError(`El adjunto "${file.name}" ya no está en el teléfono.`);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (!file.uploadToken) {
        const { upload } = await authenticatedRequest<{ upload: { upload_token: string; received_bytes: number; chunk_size: number } }>(
          'uploads/sessions',
          {
            method: 'POST',
            token,
            body: JSON.stringify({
              lesson_id: draft.lessonId,
              filename: file.name,
              mime_type: file.mimeType,
              total_bytes: file.size,
              chunk_size: CHUNK_SIZE,
            }),
          },
        );
        file = { ...file, uploadToken: upload.upload_token, received: upload.received_bytes, chunkSize: upload.chunk_size, completed: false };
        await persist(file);
      }

      // Fragmentos en orden, desde received_bytes.
      while ((file.received ?? 0) < file.size) {
        const start = file.received ?? 0;
        const length = Math.min(file.chunkSize ?? CHUNK_SIZE, file.size - start);
        const bytes = readRange(file.uri, start, length);
        const result = await authenticatedRequest<{ received_bytes: number }>(`uploads/${file.uploadToken}`, {
          method: 'PUT',
          token,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes ${start}-${start + bytes.byteLength - 1}/${file.size}`,
          },
          body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        });
        file = { ...file, received: result.received_bytes };
        await persist(file);
      }

      await authenticatedRequest(`uploads/${file.uploadToken}/complete`, { method: 'POST', token });
      file = { ...file, completed: true };
      await persist(file);
      return;
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 404 || reason.status === 410)) {
        // Sesión caducada o limpiada: sesión nueva, desde cero.
        file = { ...file, uploadToken: undefined, received: 0, completed: false };
        await persist(file);
        continue;
      }
      if (reason instanceof ApiError && reason.status === 409 && typeof reason.data?.received_bytes === 'number') {
        // El servidor tiene otro avance: reanudar desde ahí.
        file = { ...file, received: reason.data.received_bytes };
        await persist(file);
        continue;
      }
      throw reason;
    }
  }
  throw new ApiError(`No se pudo completar la subida de "${file.name}".`, 0, 'upload_retry');
}

registerOutboxHandler<AssignmentDraft>(ASSIGNMENT_SUBMISSION, async (event, { save, token }) => {
  const draft: AssignmentDraft = { ...event.payload, files: event.payload.files.map((file) => ({ ...file })) };
  await ensureUploadNetwork(draft);
  for (let index = 0; index < draft.files.length; index += 1) {
    await uploadFile(draft, index, token, save);
  }

  try {
    await authenticatedRequest<{ submission: AssignmentSubmission; replayed: boolean }>(
      `assignments/${draft.lessonId}/submissions`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({
          client_event_id: event.id,
          body_text: draft.bodyText,
          files: draft.files.map((file) => ({ upload_token: file.uploadToken })),
          client_submitted_at: draft.clientSubmittedAt,
        }),
      },
    );
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 404 && reason.code === 'atora_mobile_upload_not_found') {
      // Las subidas caducaron antes de crear la entrega: se repiten desde cero, mismo client_event_id.
      await save({ ...draft, files: draft.files.map((file) => ({ ...file, uploadToken: undefined, received: 0, completed: false })) });
      throw new ApiError('Las subidas caducaron; se volverán a enviar.', 0, 'upload_expired');
    }
    throw reason;
  }

  deleteEventFiles(event.id);
});
