/// <reference types="node" />
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * El indicio de texto generado por IA es solo para el docente: ninguna pantalla
 * ni tipo del estudiante lo menciona (el servidor tampoco lo manda en sus rutas).
 */
describe('el indicio de IA nunca está en pantallas del estudiante', () => {
  const src = join(__dirname, '..', '..');
  const screens = readdirSync(join(src, 'screens')).filter((f) => f.endsWith('.tsx')).map((f) => join(src, 'screens', f));
  const files = [...screens, join(src, 'types.ts'), join(src, 'ai', 'conversation.ts'), join(src, 'api', 'ai.ts')];

  it.each(files.map((f) => [f.replace(src, 'src')]))('%s', (relative) => {
    const text = readFileSync(join(src, relative.replace(/^src[\\/]/, '')), 'utf8');
    expect(text).not.toMatch(/ai_likelihood|Indicio|indicio/);
  });

  it('incluye la pantalla del asistente', () => {
    expect(screens.some((f) => f.endsWith('AssistantScreen.tsx'))).toBe(true);
  });
});
