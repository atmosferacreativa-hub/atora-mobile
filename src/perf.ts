/**
 * Marcas de rendimiento (1.0.0). Una línea en el registro del sistema
 * (`[atora-perf] …`) que mide `scripts/perf-run.sh` en el emulador de gama baja.
 * Sin datos personales: solo el nombre de la marca y milisegundos.
 */
const done = new Set<string>();

export function perfMark(name: string, ms?: number, once = true): void {
  if (once && done.has(name)) return;
  done.add(name);
  // eslint-disable-next-line no-console
  console.log(`[atora-perf] ${name}${ms === undefined ? '' : ` ${Math.round(ms)}`}`);
}

export function perfNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}
