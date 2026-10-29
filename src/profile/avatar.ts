/**
 * 1.4.0 (plugin 6.41.0): foto de perfil. Módulo puro, para Jest.
 *
 * El servidor manda `avatar_url` (vacío si la persona no subió foto), `avatar_initials` y `avatar_color`. Sin foto, la
 * app dibuja las iniciales con ese color. Con un servidor viejo (sin esos campos) se calculan aquí.
 */

export type AvatarSource = { name?: string; display_name?: string; avatar_url?: string | null; avatar_initials?: string; avatar_color?: string; id?: number };

export type AvatarView = { kind: 'photo'; uri: string } | { kind: 'initials'; initials: string; color: string };

/** Primera letra del primer y del último nombre. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = Array.from(parts[0]!)[0] ?? '';
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1]!)[0] ?? '' : '';
  return (first + last).toLocaleUpperCase() || '?';
}

/** Color estable por persona (mismo tono que usa el servidor cuando no manda el suyo). */
export function colorFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return `hsl(${hash % 360}, 55%, 45%)`;
}

/** Las URL viejas de Gravatar se ignoran: la app nunca pide nada a ese servicio. */
export function isUsablePhoto(uri: string | null | undefined): uri is string {
  if (!uri) return false;
  if (uri.startsWith('data:image/svg')) return false;
  return !/gravatar\.com/i.test(uri);
}

export function avatarView(person: AvatarSource): AvatarView {
  if (isUsablePhoto(person.avatar_url)) return { kind: 'photo', uri: person.avatar_url };
  const name = person.name ?? person.display_name ?? '';
  return {
    kind: 'initials',
    initials: person.avatar_initials || initialsFrom(name),
    color: person.avatar_color || colorFor(String(person.id ?? name)),
  };
}

/** Saludo de Hoy: el primer nombre. */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? '';
}
