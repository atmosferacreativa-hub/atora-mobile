import type { LessonResource } from '../types';
import { formatBytes } from '../offline/downloadsMath';

/**
 * 1.2.0 (plugin 6.37.0): datos visibles de un audio antes de descargarlo o escucharlo.
 * Aceptar un formato no garantiza que se reproduzca: la compatibilidad la declara el servidor
 * (docs/AUDIO.md del plugin) y aquí solo se decide si mostrar el aviso.
 */

export const AUDIO_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** "3:05 · 2.4 MB · MP3" (lo que se conoce). */
export function audioMetaLine(resource: Pick<LessonResource, 'duration_seconds' | 'bytes' | 'audio_format'>, savedBytes?: number | null): string {
  return [
    formatDuration(resource.duration_seconds),
    formatBytes(savedBytes ?? resource.bytes),
    resource.audio_format ? resource.audio_format.toUpperCase() : '',
  ].filter(Boolean).join(' · ');
}

/**
 * Aviso de compatibilidad: solo cuando el servidor lo marca como limitado. En iOS siempre se muestra;
 * en Android OGG se reproduce, así que el aviso (pensado para iPhone y Safari) no se muestra.
 */
export function compatibilityNote(resource: Pick<LessonResource, 'compatibility' | 'audio_format'>, platformOS: string): string {
  const compat = resource.compatibility;
  if (!compat || compat.status !== 'limited' || !compat.note) return '';
  if (platformOS === 'android' && resource.audio_format === 'ogg') return '';
  return compat.note;
}

export function nextRate(current: number): number {
  const index = AUDIO_RATES.findIndex((rate) => Math.abs(rate - current) < 0.001);
  return AUDIO_RATES[(index + 1) % AUDIO_RATES.length] ?? 1;
}

export function formatRate(rate: number): string {
  return `${String(rate).replace('.', ',')}×`;
}

/** Posición a la que saltar al abrir: nada si está al final o casi (para empezar de nuevo). */
export function startPosition(saved: number, duration: number | null | undefined): number {
  if (!Number.isFinite(saved) || saved <= 0) return 0;
  if (duration && Number.isFinite(duration) && duration > 0 && saved >= duration - 2) return 0;
  return Math.floor(saved);
}

export function clampSeek(current: number, delta: number, duration: number | null | undefined): number {
  const target = current + delta;
  const max = duration && Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(max, target));
}
