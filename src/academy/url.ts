/**
 * URL de la academia (1.0.1, punto 5). Módulo puro, para Jest.
 *
 * Corrige lo que se escribe mal con el teclado del teléfono antes de guardar:
 * `https;//`, `https//`, `http:/`, espacios, mayúsculas en el dominio, barras
 * finales y el endpoint pegado entero; agrega `https://` si falta. Devuelve la
 * dirección del sitio, o `null` si no es una URL válida.
 */
const API_SUFFIX = /\/wp-json\/atora(?:-mobile)?\/v1\/?$/i;
const HOST = /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?::\d{1,5})?$/;

export function normalizeAcademyUrl(input: string): string | null {
  let text = (input ?? '').replace(/\s+/g, '');
  if (!text) return null;
  // Esquema mal escrito: "https;//", "https//", "http:/", "https;/", "https:\\\\"…
  const scheme = /^(https?)[:;]*[/\\]*/i.exec(text);
  let protocol = 'https';
  if (scheme && /^(https?)[:;/\\]/i.test(text)) {
    protocol = scheme[1]!.toLowerCase();
    text = text.slice(scheme[0].length);
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^/:]+:\d/.test(text)) {
    return null; // otro esquema (ftp:, javascript:…)
  }
  text = text.replace(API_SUFFIX, '').replace(/\/+$/, '');
  const slash = text.indexOf('/');
  const host = (slash === -1 ? text : text.slice(0, slash)).toLowerCase();
  const path = slash === -1 ? '' : text.slice(slash).replace(/\/{2,}/g, '/');
  if (!HOST.test(host)) return null;
  return `${protocol}://${host}${path}`;
}

export function academyApiBase(site: string): string {
  return `${site.replace(/\/+$/, '')}/wp-json/atora-mobile/v1`;
}
