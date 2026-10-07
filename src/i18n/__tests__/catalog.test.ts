/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { en } from '../en';
import { scanSource } from '../scan';

/**
 * 1.0.0: idiomas completos. Falla si en una pantalla queda un texto visible sin
 * pasar por t(), o si una clave usada en la app no tiene traducción al inglés.
 */
const root = join(__dirname, '..', '..', '..');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path);
  return /\.tsx?$/.test(name) && !name.endsWith('.generated.ts') ? [path] : [];
});
const all = [...walk(join(root, 'src')), join(root, 'App.tsx')];
const screens = all.filter((path) => path.endsWith('.tsx'));

describe('catálogo de idiomas', () => {
  it('ninguna pantalla muestra un texto sin traducir', () => {
    const pending = screens.flatMap((path) => scanSource(path, readFileSync(path, 'utf8')).findings.map((f) => `${relative(root, path)}:${f.line} [${f.kind}] ${f.text}`));
    expect(pending).toEqual([]);
  });

  it('cada texto usado tiene su traducción al inglés, con los mismos parámetros', () => {
    const keys = new Set(all.flatMap((path) => scanSource(path, readFileSync(path, 'utf8')).keys));
    const missing = [...keys].filter((key) => !(key in en));
    expect(missing).toEqual([]);
    const params = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');
    const mismatched = [...keys].filter((key) => key in en && params(key) !== params(en[key]!));
    expect(mismatched).toEqual([]);
  });

  it('el catálogo no está vacío y no tiene traducciones vacías', () => {
    expect(Object.keys(en).length).toBeGreaterThan(300);
    expect(Object.entries(en).filter(([, value]) => !value.trim())).toEqual([]);
  });
});
