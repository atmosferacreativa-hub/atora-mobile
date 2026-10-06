/**
 * Rúbrica al calificar (0.8.0). Módulo puro, para Jest.
 *
 * Misma regla que el servidor (`CLMS_Rubric_Level_Bands`, 6.29.3, y el guardado
 * de SpeedGrader): un puntaje exacto marca su nivel; entre dos niveles se
 * resalta el de abajo con "entre X y Y"; bajo el primero, "por debajo de X".
 * Puntaje por criterio entre 0 y el máximo, con 2 decimales como máximo (acepta
 * coma). Porcentaje de la rúbrica: puntos obtenidos / máximos, redondeado.
 */
export type Level = { label: string; points: number };
export type Band = { min: number; max: number; label: string; active_points: number | null; between: string; below: string };

const EPS = 0.0001;

/** Bandas de un criterio (como `CLMS_Rubric_Level_Bands::build`). */
export function buildBands(levels: Level[], maxPoints: number): Band[] {
  const max = Math.max(0, Math.trunc(maxPoints));
  if (!levels.length || max <= 0) return [];
  const ordered = levels
    .map((level, i) => ({ i, label: String(level.label ?? '').trim(), pts: Math.max(0, Math.trunc(Number(level.points) || 0)) }))
    .sort((a, b) => (a.pts === b.pts ? a.i - b.i : a.pts - b.pts));
  const unique: typeof ordered = [];
  for (const row of ordered) if (!unique.some((u) => u.pts === row.pts)) unique.push(row);
  const bands: Band[] = [];
  const first = unique[0];
  if (!first) return [];
  if (first.pts > 0) {
    bands.push({ min: 0, max: Math.max(0, first.pts - EPS), label: '', active_points: null, between: '', below: `por debajo de ${first.label || 'el primer nivel'}` });
  }
  bands.push({ min: first.pts, max: first.pts, label: first.label, active_points: first.pts, between: '', below: '' });
  for (let j = 1; j < unique.length; j++) {
    const prev = unique[j - 1];
    const cur = unique[j];
    if (!prev || !cur) continue;
    if (cur.pts - prev.pts > EPS) {
      bands.push({ min: prev.pts + EPS, max: cur.pts - EPS, label: prev.label, active_points: prev.pts, between: `entre ${prev.label || 'nivel anterior'} y ${cur.label || 'nivel siguiente'}`, below: '' });
    }
    bands.push({ min: cur.pts, max: cur.pts, label: cur.label, active_points: cur.pts, between: '', below: '' });
  }
  return bands.map((band) => ({ ...band, min: Math.max(0, band.min), max: Math.min(max, band.max) }));
}

/** La última banda que contiene el valor (como el panel de SpeedGrader). */
function match(bands: Band[], value: number): Band | null {
  let found: Band | null = null;
  for (const band of bands) if (value >= band.min && value <= band.max) found = band;
  return found;
}

/** Lo que se muestra para un puntaje: nivel exacto, "entre X y Y" o "por debajo de X". */
export function describe(bands: Band[], value: number): string {
  const band = match(bands, value);
  if (!band) return '';
  return band.below || band.between || band.label;
}

/** Puntos del nivel resaltado (entre dos niveles, el de abajo), o null. */
export function activePoints(bands: Band[], value: number): number | null {
  const band = match(bands, value);
  return band && band.active_points !== null ? band.active_points : null;
}

export type ScoreCheck = { ok: true; value: number | null } | { ok: false; error: string };

/** Valida un puntaje escrito por el docente con la regla del servidor. Vacío = sin puntaje. */
export function parseScore(raw: string, maxPoints: number, criterion = ''): ScoreCheck {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (text === '') return { ok: true, value: null };
  if (!/^-?\d+(\.\d+)?$/.test(text)) return { ok: false, error: `Puntaje inválido para el criterio "${criterion}": debe ser un número.` };
  const decimals = text.includes('.') ? (text.split('.')[1] ?? '').length : 0;
  if (decimals > 2) return { ok: false, error: `Puntaje inválido para el criterio "${criterion}": máximo 2 decimales.` };
  const value = Number(text);
  if (value < 0 || value > maxPoints) return { ok: false, error: `Puntaje fuera de rango para el criterio "${criterion}": debe estar entre 0 y ${maxPoints}.` };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

export type CriterionScore = { maxPoints: number; score: number | null };

/** Total parcial y % de la rúbrica (el que se copia a la nota final), como el servidor. */
export function rubricTotal(criteria: CriterionScore[]): { earned: number; max: number; scored: number; percent: number | null } {
  const max = criteria.reduce((sum, c) => sum + Math.max(0, Math.trunc(c.maxPoints)), 0);
  const scoredList = criteria.filter((c) => c.score !== null);
  const earned = Math.round(scoredList.reduce((sum, c) => sum + (c.score as number), 0) * 100) / 100;
  const percent = max > 0 && scoredList.length > 0 ? Math.round((earned / max) * 100) : null;
  return { earned, max, scored: scoredList.length, percent };
}

/** Nota final: entera 0–100 (como el servidor); vacía = sin nota. */
export function parseFinalGrade(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (text === '') return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: 'La nota debe ser numérica.' };
  return { ok: true, value: Math.max(0, Math.min(100, Math.round(Number(text)))) };
}
