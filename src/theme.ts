/**
 * Sistema visual ATORA (0.3.0): única fuente de colores, espacios, radios y tipografía.
 * Paleta tomada de Atora Meridian (theme.json): azul vivo y ámbar de la marca,
 * fondos claros y luminosos; el casi negro (`ink`) solo para texto.
 */
const palette = {
  blue: '#1F5BFF',
  blueDeep: '#0B2C8F',
  amber: '#FFB020',
  amberSoft: '#FFF1D1',
  ink: '#10162A',
  ink2: '#4A5270',
  background: '#F3F6FF',
  line: '#DCE2F4',
  white: '#FFFFFF',
  red: '#C2362F',
  green: '#1E8A5A',
} as const;

export const colors = {
  // Semánticos (usar estos en código nuevo).
  primary: palette.blue,
  primaryStrong: palette.blueDeep,
  primarySoft: '#E8EFFF',
  accent: palette.amber,
  accentSoft: palette.amberSoft,
  /** Ámbar legible sobre fondos claros. */
  accentText: '#9A5B00',
  background: palette.background,
  surface: palette.white,
  surfaceMuted: '#EEF2FC',
  text: palette.ink,
  textMuted: palette.ink2,
  line: palette.line,
  danger: palette.red,
  dangerSoft: '#FDECEC',
  successSoft: '#E3F4EC',
  overlay: 'rgba(11, 44, 143, 0.72)',
  backdrop: 'rgba(16, 22, 42, 0.45)',

  // Nombres heredados: apuntan a la paleta nueva para que las pantallas existentes la adopten sin cambios.
  navy: palette.blueDeep,
  blue: palette.blue,
  mustard: palette.amber,
  red: palette.red,
  white: palette.white,
  paper: palette.background,
  ink: palette.ink,
  muted: palette.ink2,
  border: palette.line,
  success: palette.green,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  heading: { color: colors.primaryStrong, fontSize: 18, fontWeight: '800' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  caption: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
} as const;
