import { activePoints, buildBands, describe as describeScore, parseFinalGrade, parseScore, rubricTotal } from '../rubric';

/** Igual que `pick()` de RubricLevelBandsTest (plugin): [puntos activos, pista]. */
function pick(bands: ReturnType<typeof buildBands>, value: number): [number | null, string] {
  for (const b of bands) {
    if (value >= b.min && value <= b.max) {
      const ap = b.active_points;
      let hint = b.below || b.between;
      if (ap !== null && Math.abs(ap - value) < 0.0001) hint = '';
      return [ap, hint];
    }
  }
  return [null, ''];
}

describe('bandas de nivel iguales al servidor (casos de RubricLevelBandsTest)', () => {
  const levels = [
    { label: 'Inicial', points: 2 },
    { label: 'En desarrollo', points: 5 },
    { label: 'Competente', points: 8 },
    { label: 'Excelente', points: 10 },
  ];
  const bands = buildBands(levels, 10);

  it('regla de umbral y etiquetas "entre"', () => {
    expect(pick(bands, 1)).toEqual([null, 'por debajo de Inicial']);
    expect(pick(bands, 2)).toEqual([2, '']);
    expect(pick(bands, 3)).toEqual([2, 'entre Inicial y En desarrollo']);
    expect(pick(bands, 5)).toEqual([5, '']);
    expect(pick(bands, 7)).toEqual([5, 'entre En desarrollo y Competente']);
    expect(pick(bands, 8)).toEqual([8, '']);
    expect(pick(bands, 9)).toEqual([8, 'entre Competente y Excelente']);
    expect(pick(bands, 10)).toEqual([10, '']);
  });

  it('ordena por puntos, no por el orden del esquema, y en empate gana el primero', () => {
    const tied = buildBands([{ label: 'B', points: 5 }, { label: 'A', points: 2 }, { label: 'B-dup', points: 5 }, { label: 'C', points: 8 }], 10);
    expect(pick(tied, 5)).toEqual([5, '']);
    expect(describeScore(tied, 5)).toBe('B');
  });

  it('decimales: el nivel se lee sin truncar (7,5 está entre En desarrollo y Competente)', () => {
    expect(describeScore(bands, 7.5)).toBe('entre En desarrollo y Competente');
    expect(activePoints(bands, 7.5)).toBe(5);
    expect(describeScore(bands, 8)).toBe('Competente');
    expect(describeScore(bands, 0.5)).toBe('por debajo de Inicial');
  });
});

describe('puntaje y total iguales al guardado del servidor', () => {
  it('valida rango y decimales como SpeedGrader (acepta coma)', () => {
    expect(parseScore('8,5', 10, 'Claridad')).toEqual({ ok: true, value: 8.5 });
    expect(parseScore('7.25', 10)).toEqual({ ok: true, value: 7.25 });
    expect(parseScore('', 10)).toEqual({ ok: true, value: null });
    expect(parseScore('7.255', 10, 'C')).toEqual({ ok: false, error: 'Puntaje inválido para el criterio "C": máximo 2 decimales.' });
    expect(parseScore('11', 10, 'C')).toEqual({ ok: false, error: 'Puntaje fuera de rango para el criterio "C": debe estar entre 0 y 10.' });
    expect(parseScore('abc', 10, 'C').ok).toBe(false);
  });

  it('total parcial y % de la rúbrica (8,5 + 7,25 de 20 → 79 %)', () => {
    expect(rubricTotal([{ maxPoints: 10, score: 8.5 }, { maxPoints: 10, score: 7.25 }])).toEqual({ earned: 15.75, max: 20, scored: 2, percent: 79 });
    expect(rubricTotal([{ maxPoints: 10, score: null }, { maxPoints: 10, score: null }]).percent).toBeNull();
    expect(rubricTotal([{ maxPoints: 10, score: 0 }, { maxPoints: 10, score: null }]).percent).toBe(0);
  });

  it('nota final entera 0–100', () => {
    expect(parseFinalGrade('78.75')).toEqual({ ok: true, value: 79 });
    expect(parseFinalGrade('')).toEqual({ ok: true, value: null });
    expect(parseFinalGrade('120')).toEqual({ ok: true, value: 100 });
    expect(parseFinalGrade('x').ok).toBe(false);
  });
});
