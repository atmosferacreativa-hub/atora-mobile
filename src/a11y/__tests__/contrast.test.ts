jest.mock('react-native', () => ({ StyleSheet: { create: (styles: unknown) => styles }, Platform: { OS: 'android', select: (o: Record<string, unknown>) => o.android ?? o.default } }), { virtual: true });
import { colors } from '../../theme';
import { contrast } from '../contrast';

/**
 * 1.0.0: contraste suficiente en el tema (WCAG AA): 4,5:1 para texto normal y
 * 3:1 para texto grande y en negrita (botones, títulos, insignias).
 */
const NORMAL: [string, string, string][] = [
  ['texto sobre fondo', colors.text, colors.background],
  ['texto sobre tarjeta', colors.text, colors.surface],
  ['texto secundario sobre fondo', colors.textMuted, colors.background],
  ['texto secundario sobre tarjeta', colors.textMuted, colors.surface],
  ['texto secundario sobre gris', colors.textMuted, colors.surfaceMuted],
  ['ámbar legible sobre ámbar suave', colors.accentText, colors.accentSoft],
  ['ámbar legible sobre tarjeta', colors.accentText, colors.surface],
  ['enlace azul sobre fondo', colors.primary, colors.background],
  ['enlace azul sobre tarjeta', colors.primary, colors.surface],
  ['azul oscuro sobre azul suave', colors.primaryStrong, colors.primarySoft],
  ['error sobre tarjeta', colors.danger, colors.surface],
  ['error sobre fondo', colors.danger, colors.background],
];
const LARGE: [string, string, string][] = [
  ['botón: blanco sobre azul', colors.white, colors.primary],
  ['botón: blanco sobre rojo', colors.white, colors.danger],
  ['aviso verde: blanco sobre verde', colors.white, colors.success],
  ['insignia: azul oscuro sobre ámbar', colors.navy, colors.mustard],
];

describe('contraste del tema', () => {
  it.each(NORMAL)('%s (≥ 4,5:1)', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(LARGE)('%s (≥ 4,5:1 también, aunque sea texto grande)', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
