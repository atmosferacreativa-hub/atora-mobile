import * as Sentry from '@sentry/react-native';
import { crashReportsAllowed, scrubBreadcrumb, scrubEvent, type CrashEvent } from './scrub';

/**
 * Reporte de cierres inesperados (1.0.0). Se activa solo si la compilación
 * trae `EXPO_PUBLIC_SENTRY_DSN` (lo configura el titular al crear la cuenta) y
 * la academia no lo desactivó. Nunca envía datos personales (ver scrub.ts).
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
let allowed = false;

export function initCrashReports(): void {
  if (!DSN || __DEV__) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: false,
    tracesSampleRate: 0,
    beforeSend: (event) => (allowed ? (scrubEvent(event as unknown as CrashEvent) as unknown as typeof event) : null),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  });
}

/** Al conocer las capacidades de la academia (o al cambiar de academia). */
export function applyAcademyCrashPreference(capability: boolean | undefined): void {
  allowed = crashReportsAllowed(capability);
}

export function wrapRoot(component: () => React.JSX.Element): () => React.JSX.Element {
  return DSN ? (Sentry.wrap(component) as unknown as () => React.JSX.Element) : component;
}
