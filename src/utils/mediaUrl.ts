import { getSiteBaseUrlSync } from '../runtimeConfig';

export function resolveMediaUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';

  const site = getSiteBaseUrlSync();
  if (!site) return trimmed;

  // Si el backend devuelve localhost, lo reemplazamos por el host real configurado
  // (necesario para dispositivos físicos).
  return trimmed
    .replace(/^http:\/\/localhost(?=[:/]|$)/i, site)
    .replace(/^http:\/\/127\.0\.0\.1(?=[:/]|$)/i, site)
    .replace(/^http:\/\/0\.0\.0\.0(?=[:/]|$)/i, site);
}

