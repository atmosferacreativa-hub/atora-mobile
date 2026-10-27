import type { LiveInfo } from '../types';

/**
 * 1.2.0 (plugin 6.39.0): estado de la clase en vivo calculado en el teléfono para la cuenta regresiva.
 * El enlace lo entrega el servidor solo con la clase abierta (10 min antes, hasta 15 min después del final):
 * cuando aquí la clase pasa a abierta y aún no hay enlace, la pantalla vuelve a pedir la lección.
 */

export const OPEN_BEFORE_MS = 10 * 60 * 1000;
export const CLOSE_AFTER_MS = 15 * 60 * 1000;

export type LiveState = LiveInfo['status'];

export function liveState(info: Pick<LiveInfo, 'starts_at' | 'ends_at'>, nowMs: number): LiveState {
  const start = info.starts_at ? Date.parse(info.starts_at) : NaN;
  if (!Number.isFinite(start)) return 'unscheduled';
  const parsedEnd = info.ends_at ? Date.parse(info.ends_at) : NaN;
  const end = Number.isFinite(parsedEnd) ? parsedEnd : start + 60 * 60 * 1000;
  if (nowMs < start - OPEN_BEFORE_MS) return 'scheduled';
  if (nowMs > end + CLOSE_AFTER_MS) return 'ended';
  return 'open';
}

/** Lo que falta para empezar, en partes (días, horas, minutos). null si ya empezó o no hay fecha. */
export function countdown(info: Pick<LiveInfo, 'starts_at'>, nowMs: number): { days: number; hours: number; minutes: number } | null {
  const start = info.starts_at ? Date.parse(info.starts_at) : NaN;
  if (!Number.isFinite(start) || start <= nowMs) return null;
  const totalMinutes = Math.ceil((start - nowMs) / 60000);
  return { days: Math.floor(totalMinutes / 1440), hours: Math.floor((totalMinutes % 1440) / 60), minutes: totalMinutes % 60 };
}

/** ¿Hay que volver a pedir la lección para obtener el enlace? */
export function needsJoinUrl(info: LiveInfo, nowMs: number): boolean {
  return liveState(info, nowMs) === 'open' && !info.join_url && info.status !== 'open';
}

/** Fecha y hora en la zona del teléfono, con el nombre de la zona. */
export function formatLocalStart(iso: string | null, locale: string | undefined, timeZone?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {}) };
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  }
}

export function phoneTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}
