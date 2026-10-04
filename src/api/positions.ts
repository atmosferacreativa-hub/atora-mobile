import { authenticatedRequest } from './authenticated';
import { getServerCapabilities } from './discovery';
import { enqueueEvent, listOutbox, newEventId, registerOutboxHandler } from '../offline/outbox/runtime';
import { PLAYBACK_POSITION, pickResume, positionDedupeKey, type PositionPayload } from '../offline/videoPositions';

/**
 * Posición de reproducción (0.4.0, plugin 6.28.0). Va a la cola como evento que
 * se reemplaza: por lección y video (0.4.1) solo viaja la última posición.
 * En el servidor gana la marca más reciente (docs/SINCRONIZACION-OFFLINE.md).
 */
export { PLAYBACK_POSITION };

registerOutboxHandler<PositionPayload>(PLAYBACK_POSITION, async (event, { token }) => {
  await authenticatedRequest(`lessons/${event.payload.lessonId}/position`, {
    method: 'PUT',
    token,
    body: JSON.stringify({
      position_seconds: Math.max(0, Math.floor(event.payload.positionSeconds)),
      duration_seconds: Math.max(0, Math.floor(event.payload.durationSeconds)),
      client_event_id: event.id,
      client_recorded_at: event.payload.recordedAt,
      // Sin clave (0.4.0 o servidor sin multi_video): primer video.
      ...(event.payload.videoKey ? { video_key: event.payload.videoKey } : {}),
    }),
  });
});

export async function savePosition(lessonId: number, positionSeconds: number, durationSeconds: number, videoKey?: string): Promise<void> {
  if (!(await getServerCapabilities()).playback_position) return;
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return;
  await enqueueEvent<PositionPayload>({
    id: newEventId(),
    type: PLAYBACK_POSITION,
    dedupeKey: positionDedupeKey(lessonId, videoKey),
    payload: {
      lessonId,
      videoKey,
      positionSeconds,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
      recordedAt: new Date().toISOString(),
    },
    replace: true,
  });
}

/** Posición para "Continuar desde": la pendiente de enviar (más nueva) o la del servidor. */
export async function resumePosition(
  lessonId: number,
  serverSeconds: number | undefined,
  videoKey?: string,
  isFirst = true,
): Promise<number> {
  const { pending } = await listOutbox().catch(() => ({ pending: [] as { dedupeKey: string; payload: unknown }[] }));
  return pickResume(pending, lessonId, videoKey, isFirst, serverSeconds);
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
