import { authenticatedRequest } from './authenticated';
import { getServerCapabilities } from './discovery';
import { enqueueEvent, listOutbox, newEventId, registerOutboxHandler } from '../offline/outbox/runtime';

/**
 * Posición de reproducción (0.4.0, plugin 6.28.0). Va a la cola como evento que
 * se reemplaza: por lección solo viaja la última posición, nunca una lista.
 * En el servidor gana la marca más reciente (docs/SINCRONIZACION-OFFLINE.md).
 */
export const PLAYBACK_POSITION = 'playback_position';

type PositionPayload = {
  lessonId: number;
  positionSeconds: number;
  durationSeconds: number;
  /** ISO 8601: cuándo se registró en el teléfono. */
  recordedAt: string;
};

const dedupeKey = (lessonId: number) => `${PLAYBACK_POSITION}:${lessonId}`;

registerOutboxHandler<PositionPayload>(PLAYBACK_POSITION, async (event, { token }) => {
  await authenticatedRequest(`lessons/${event.payload.lessonId}/position`, {
    method: 'PUT',
    token,
    body: JSON.stringify({
      position_seconds: Math.max(0, Math.floor(event.payload.positionSeconds)),
      duration_seconds: Math.max(0, Math.floor(event.payload.durationSeconds)),
      client_event_id: event.id,
      client_recorded_at: event.payload.recordedAt,
    }),
  });
});

export async function savePosition(lessonId: number, positionSeconds: number, durationSeconds: number): Promise<void> {
  if (!(await getServerCapabilities()).playback_position) return;
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return;
  await enqueueEvent<PositionPayload>({
    id: newEventId(),
    type: PLAYBACK_POSITION,
    dedupeKey: dedupeKey(lessonId),
    payload: { lessonId, positionSeconds, durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0, recordedAt: new Date().toISOString() },
    replace: true,
  });
}

/** Posición para "Continuar desde": la pendiente de enviar (más nueva) o la del servidor. */
export async function resumePosition(lessonId: number, serverSeconds: number | undefined): Promise<number> {
  const { pending } = await listOutbox().catch(() => ({ pending: [] as { dedupeKey: string; payload: unknown }[] }));
  const local = pending.find((event) => event.dedupeKey === dedupeKey(lessonId));
  if (local) return Math.floor((local.payload as PositionPayload).positionSeconds);
  return Math.floor(serverSeconds ?? 0);
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
