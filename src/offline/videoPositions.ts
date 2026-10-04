/**
 * Posición por video (0.4.1). Módulo puro: sin React Native, para Jest.
 *
 * El evento reemplazable de la cola se identifica por lección + video. Los
 * eventos de 0.4.0 (solo lección) pertenecen al primer video.
 */
export const PLAYBACK_POSITION = 'playback_position';

export type PositionPayload = {
  lessonId: number;
  /** 0.4.1: `videos[].key`; ausente en eventos de 0.4.0 y con servidores sin multi_video. */
  videoKey?: string;
  positionSeconds: number;
  durationSeconds: number;
  /** ISO 8601: cuándo se registró en el teléfono. */
  recordedAt: string;
};

export function positionDedupeKey(lessonId: number, videoKey?: string): string {
  return videoKey ? `${PLAYBACK_POSITION}:${lessonId}:${videoKey}` : `${PLAYBACK_POSITION}:${lessonId}`;
}

/**
 * Posición para "Continuar desde": la pendiente de enviar (más nueva) de ese
 * video o, si no hay, la del servidor. Para el primer video también cuenta un
 * evento de 0.4.0 sin clave; gana la marca más reciente.
 */
export function pickResume(
  pending: { dedupeKey: string; payload: unknown }[],
  lessonId: number,
  videoKey: string | undefined,
  isFirst: boolean,
  serverSeconds: number | undefined,
): number {
  const keys = new Set([positionDedupeKey(lessonId, videoKey)]);
  if (isFirst) keys.add(positionDedupeKey(lessonId));
  const local = pending
    .filter((event) => keys.has(event.dedupeKey))
    .map((event) => event.payload as PositionPayload)
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0];
  return Math.floor(local ? local.positionSeconds : serverSeconds ?? 0);
}
