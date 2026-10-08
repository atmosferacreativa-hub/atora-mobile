/**
 * 1.0.1: posición de desplazamiento para que un campo (`top`/`height` dentro
 * del contenido) quede visible con `gap` de margen sobre el borde inferior del
 * área visible (ya achicada por el teclado). `null`: no hace falta moverse.
 * Módulo puro, para Jest.
 */
export function scrollTargetFor(p: { top: number; height: number; offset: number; viewport: number; gap: number }): number | null {
  const bottom = p.top + p.height + p.gap;
  if (bottom > p.offset + p.viewport) return Math.max(0, bottom - p.viewport);
  if (p.top - p.gap < p.offset) return Math.max(0, p.top - p.gap);
  return null;
}
