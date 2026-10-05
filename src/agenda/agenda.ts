/**
 * Agenda (0.6.0). Módulo puro, para Jest: rangos, agrupación por día y uso de
 * lo último sincronizado cuando no hay conexión.
 */
import type { AgendaItem } from '../types';

export type AgendaView = 'day' | 'week';

/** Fecha local "YYYY-MM-DD" de una marca. */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return localDay(new Date(y, m - 1, d + days));
}

/** Lunes de la semana de ese día. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const offset = (date.getDay() + 6) % 7;
  return addDays(day, -offset);
}

/** Rango que se pide al servidor para una vista: un día, o lunes a domingo. */
export function rangeFor(view: AgendaView, day: string): { from: string; to: string } {
  if (view === 'day') return { from: day, to: day };
  const start = weekStart(day);
  return { from: start, to: addDays(start, 6) };
}

/** Elementos agrupados por día local, en orden, incluidos los días vacíos del rango. */
export function groupByDay(items: AgendaItem[], from: string, to: string): { day: string; items: AgendaItem[] }[] {
  const days: { day: string; items: AgendaItem[] }[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push({ day, items: [] });
  const index = new Map(days.map((entry) => [entry.day, entry]));
  for (const item of [...items].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))) {
    const day = localDay(new Date(item.starts_at));
    index.get(day)?.items.push(item);
  }
  return days;
}

export type CachedAgenda = { from: string; to: string; items: AgendaItem[]; syncedAt: number };

/**
 * Sin conexión: lo último sincronizado que cubre el rango pedido (filtrado a
 * ese rango), con su fecha. Si nada lo cubre, null.
 */
export function offlineAgenda(cached: CachedAgenda[], from: string, to: string): CachedAgenda | null {
  const covering = cached.filter((entry) => entry.from <= from && entry.to >= to).sort((a, b) => b.syncedAt - a.syncedAt)[0];
  if (!covering) return null;
  const items = covering.items.filter((item) => {
    const day = localDay(new Date(item.starts_at));
    return day >= from && day <= to;
  });
  return { from, to, items, syncedAt: covering.syncedAt };
}
