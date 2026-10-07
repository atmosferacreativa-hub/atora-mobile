/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { scanA11y } from '../scan';

/** 1.0.0: botones con etiqueta para lector de pantalla y área táctil de 44 puntos o más. */
const root = join(__dirname, '..', '..', '..');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path);
  return name.endsWith('.tsx') ? [path] : [];
});
const files = [...walk(join(root, 'src')), join(root, 'App.tsx')];

describe('accesibilidad de los elementos tocables', () => {
  it('cada botón sin texto tiene etiqueta y todos miden al menos 44 puntos', () => {
    const findings = files.flatMap((path) => scanA11y(path, readFileSync(path, 'utf8')).map((f) => `${relative(root, path)}:${f.line} [${f.problem}] ${f.detail}`));
    expect(findings).toEqual([]);
  });
});
