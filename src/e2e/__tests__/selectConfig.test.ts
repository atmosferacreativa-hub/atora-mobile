// El CI corre a veces solo algunos recorridos de Maestro. Con archivos sueltos Maestro ignora flowsOrder y los corre en
// orden alfabético; scripts/e2e-select-config.py arma el config.yaml de la selección conservando el orden.
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..');

function order(names: string[]): string[] {
  const out = join(mkdtempSync(join(tmpdir(), 'e2e-')), 'config.yaml');
  execFileSync('python3', [join(root, 'scripts/e2e-select-config.py'), join(root, '.maestro/config.yaml'), out, ...names]);
  const text = readFileSync(out, 'utf8');
  const after = text.split('flowsOrder:')[1] ?? '';
  return after.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
}

test('los recorridos del docente que comparten entregas corren en el orden de config.yaml, no en el alfabético', () => {
  const picked = order(['docente-borrador-recuperado', 'docente-calificar-409', 'docente-calificar', 'docente-sugerencia-ia', 'login']);
  expect(picked).toEqual(['login', 'docente-sugerencia-ia', 'docente-calificar', 'docente-calificar-409', 'docente-borrador-recuperado']);
});

test('no deja en flowsOrder recorridos que no se pidieron (Maestro fallaría al no encontrarlos)', () => {
  expect(order(['leccion'])).toEqual(['leccion']);
});

test('los recorridos pedidos que no están en flowsOrder se agregan al final (Maestro se saltaba algunos)', () => {
  expect(order(['docente-asistencia', 'docente-calificar', 'docente-precalificacion', 'login'])).toEqual([
    'login',
    'docente-calificar',
    'docente-asistencia',
    'docente-precalificacion',
  ]);
});
