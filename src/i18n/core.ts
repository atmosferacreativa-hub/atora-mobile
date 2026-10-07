/**
 * Idiomas (1.0.0). Módulo puro, para Jest.
 *
 * El texto en español es la clave: `t('Calificar')`. En inglés se busca en el
 * catálogo `en`; si faltara una clave se muestra el español (y la prueba de
 * catálogo falla). Parámetros con llaves: `t('Intento {n}', { n: 2 })`.
 */
import { en } from './en';

export type Language = 'es' | 'en';
export type LanguagePreference = 'system' | Language;

let current: Language = 'es';
const listeners = new Set<(language: Language) => void>();

export function getLanguage(): Language {
  return current;
}

export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  listeners.forEach((listener) => listener(language));
}

export function subscribeLanguage(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Preferencia del usuario o, con "sistema", el idioma del teléfono: español si es español; si no, inglés. */
export function resolveLanguage(preference: LanguagePreference, deviceLanguageCodes: (string | null | undefined)[]): Language {
  if (preference === 'es' || preference === 'en') return preference;
  const first = (deviceLanguageCodes.find(Boolean) ?? 'es').toLowerCase();
  return first.startsWith('es') ? 'es' : 'en';
}

export function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function t(key: string, params?: Record<string, string | number>): string {
  const text = current === 'en' ? (en[key] ?? key) : key;
  return interpolate(text, params);
}

/**
 * Marca una clave del catálogo sin traducirla todavía (mapas de estados que se
 * definen una vez y se muestran con t() al dibujar). La prueba de catálogo la reconoce.
 */
export function tk<T extends string>(key: T): T {
  return key;
}

/** Formato de fecha y hora del idioma activo. */
export function locale(): string {
  return current === 'en' ? 'en' : 'es';
}
