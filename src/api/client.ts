import { config } from '../config';
import { getApiBaseUrlSync } from '../runtimeConfig';
import { t } from '../i18n/core';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    /** `data` del error REST (p. ej. `received_bytes` en una subida fuera de orden). */
    readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** `baseUrl`: 1.0.1, para enviar a una academia concreta (bajas pendientes), no a la configurada ahora. */
type RequestOptions = RequestInit & { token?: string; baseUrl?: string };

export function isOfflineError(reason: unknown): boolean {
  return reason instanceof ApiError && reason.status === 0;
}

export function isRetriableError(reason: unknown): boolean {
  if (!(reason instanceof ApiError)) return false;
  if (reason.status === 0) return true;
  return reason.status >= 500;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const apiBaseUrl = options.baseUrl || getApiBaseUrlSync() || config.apiBaseUrl;
  if (!apiBaseUrl) {
    throw new ApiError(t('La URL de la academia no está configurada.'), 0, 'missing_api_url');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const { token, headers, baseUrl: _baseUrl, ...requestOptions } = options;

  try {
    const response = await fetch(`${apiBaseUrl}/${path.replace(/^\//, '')}`, {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        payload?.message ?? t('La academia respondió con el error {status}.', { status: response.status }),
        response.status,
        payload?.code,
        payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : undefined,
      );
    }

    if (payload === null) {
      throw new ApiError(
        t('La academia respondió en un formato no válido. Revisa la API REST y la caché del sitio.'),
        response.status,
        'invalid_json',
      );
    }

    return payload as T;
  } catch (reason) {
    if (reason instanceof ApiError) {
      throw reason;
    }
    if (reason instanceof Error && reason.name === 'AbortError') {
      throw new ApiError(
        t('La academia tardó demasiado en responder. Revisa la conexión e inténtalo otra vez.'),
        0,
        'request_timeout',
      );
    }
    throw new ApiError(
      t('No pudimos conectar con la academia. Verifica la URL, Internet, HTTPS y el plugin ATORA LMS.'),
      0,
      'network_error',
    );
  } finally {
    clearTimeout(timeout);
  }
}
