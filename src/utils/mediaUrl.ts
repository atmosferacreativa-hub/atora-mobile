import { getSiteBaseUrlSync } from '../runtimeConfig';

function normalizeOrigin(input: string): string {
  const value = (input || '').trim().replace(/\/+$/, '');
  if (!value) return '';

  // Best effort: URL.origin
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export function resolveMediaUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';

  const site = getSiteBaseUrlSync();
  if (!site) return trimmed;

  const siteOrigin = normalizeOrigin(site);
  if (!siteOrigin) return trimmed;

  // Relativas (/wp-content/...) → absolutas según la academia configurada.
  if (/^\//.test(trimmed)) {
    return `${siteOrigin}${trimmed}`;
  }

  // Si el backend devuelve localhost/127.0.0.1/0.0.0.0, reemplazamos el ORIGIN completo
  // (incluyendo puerto) por el origin real configurado.
  return trimmed.replace(
    /^(https?:)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?=\/|$)/i,
    siteOrigin,
  );
}
