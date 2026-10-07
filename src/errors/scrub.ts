/**
 * Reporte de errores (1.0.0). Módulo puro, para Jest: lo que sale hacia el
 * servicio de errores nunca lleva datos personales.
 *
 * - Sin usuario, IP, cabeceras ni cuerpo de peticiones.
 * - Las URL pierden la consulta (tokens y firmas) y la parte del camino que no
 *   sea de la API.
 * - Correos y tokens que aparezcan en mensajes se reemplazan.
 */
export type CrashEvent = {
  user?: unknown;
  request?: { url?: string; headers?: unknown; data?: unknown; cookies?: unknown; query_string?: unknown };
  extra?: unknown;
  contexts?: Record<string, unknown>;
  message?: string;
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: Breadcrumb[];
  server_name?: string;
};
export type Breadcrumb = { message?: string; data?: Record<string, unknown>; category?: string };

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TOKEN = /\b(?:Bearer\s+)?[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]+)?\b|\b(?:tok_|atm_|rt_)[A-Za-z0-9]{16,}\b/g;

export function scrubText(text: string): string {
  return text.replace(EMAIL, '[correo]').replace(TOKEN, '[token]');
}

/** Sin consulta ni fragmento: el resto del camino de la API no identifica a nadie. */
export function scrubUrl(url: string): string {
  return url.split(/[?#]/)[0] ?? '';
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  // Lo que se escribió en la pantalla (pulsaciones con texto) no se guarda.
  if (crumb.category === 'ui.input' || crumb.category === 'console') return null;
  const data = crumb.data ? { ...crumb.data } : undefined;
  if (data) {
    if (typeof data.url === 'string') data.url = scrubUrl(data.url);
    delete data.request_body_size;
    delete data.response_body_size;
  }
  return { ...crumb, message: crumb.message ? scrubText(crumb.message) : crumb.message, data };
}

export function scrubEvent<T extends CrashEvent>(event: T): T {
  const clean: T = { ...event };
  delete clean.user;
  delete clean.extra;
  delete clean.server_name;
  if (clean.request) clean.request = { url: clean.request.url ? scrubUrl(clean.request.url) : undefined };
  if (clean.contexts) {
    const contexts = { ...clean.contexts };
    delete contexts.profile;
    clean.contexts = contexts;
  }
  if (clean.message) clean.message = scrubText(clean.message);
  if (clean.exception?.values) {
    clean.exception = { ...clean.exception, values: clean.exception.values.map((value) => ({ ...value, value: value.value ? scrubText(value.value) : value.value })) };
  }
  if (clean.breadcrumbs) clean.breadcrumbs = clean.breadcrumbs.map(scrubBreadcrumb).filter((crumb): crumb is Breadcrumb => crumb !== null);
  return clean;
}

/**
 * ¿Se puede enviar? Solo si la academia lo permite (`crash_reports` en
 * /discovery). Mientras no se sabe (al arrancar), no se envía nada.
 */
export function crashReportsAllowed(capability: boolean | undefined): boolean {
  return capability === true;
}
