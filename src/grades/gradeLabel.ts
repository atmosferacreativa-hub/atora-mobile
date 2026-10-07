import { t } from '../i18n/core';
/**
 * Nota que muestra la app (0.5.3). Módulo puro, para Jest.
 * El servidor envía `null` cuando no hay notas y `0` cuando la nota es cero
 * (ATORA LMS 6.29.5); la app nunca convierte uno en el otro.
 */
/** Clave del catálogo (el texto visible pasa por t()). */
export const NO_GRADES = 'Sin calificaciones';

export function gradeLabel(grade: number | null | undefined): { text: string; empty: boolean } {
  if (grade === null || grade === undefined || Number.isNaN(grade)) return { text: t(NO_GRADES), empty: true };
  return { text: String(Math.round(grade * 10) / 10), empty: false };
}
