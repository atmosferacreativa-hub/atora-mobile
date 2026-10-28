import type { TeacherLesson } from './types';

/**
 * 1.3.0: ayudas para la lista de lecciones del docente. La fecha de entrega se edita en la zona del sitio (como la
 * guarda el servidor), con pasos de días y horas comunes; no hace falta un selector nativo.
 */

export const DUE_TIMES = ['08:00', '12:00', '18:00', '23:59'] as const;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as unknown as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Suma días a una fecha "AAAA-MM-DD" (calendario, sin zona horaria). */
export function shiftDate(value: string, days: number): string {
  const match = DATE_RE.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

/** Fecha de hoy en una zona horaria ("AAAA-MM-DD"). */
export function todayIn(timeZone: string | undefined, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    return isValidDate(parts) ? parts : now.toISOString().slice(0, 10);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Fecha inicial para editar: la actual de la tarea o, si no tiene, dentro de una semana. */
export function initialDue(lesson: Pick<TeacherLesson, 'due_date' | 'due_time' | 'site_timezone'>, now: Date = new Date()): { date: string; time: string } {
  if (lesson.due_date && isValidDate(lesson.due_date)) return { date: lesson.due_date, time: lesson.due_time || '23:59' };
  return { date: shiftDate(todayIn(lesson.site_timezone, now), 7), time: '23:59' };
}

/** ¿Es una actividad con entrega (se le puede poner fecha)? */
export function hasDeadline(lesson: Pick<TeacherLesson, 'type' | 'due_date'>): boolean {
  return ['tarea', 'proyecto', 'quiz'].includes(lesson.type) || Boolean(lesson.due_date);
}
