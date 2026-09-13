import { config } from '../config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = RequestInit & { token?: string };

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!config.apiBaseUrl) {
    throw new ApiError('La URL de la academia no está configurada.', 0, 'missing_api_url');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const { token, headers, ...requestOptions } = options;

  try {
    const response = await fetch(`${config.apiBaseUrl}/${path.replace(/^\//, '')}`, {
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
        payload?.message ?? `La academia respondió con el error ${response.status}.`,
        response.status,
        payload?.code,
      );
    }

    if (payload === null) {
      throw new ApiError(
        'La academia respondió en un formato no válido. Revisa la API REST y la caché del sitio.',
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
        'La academia tardó demasiado en responder. Revisa la conexión e inténtalo otra vez.',
        0,
        'request_timeout',
      );
    }
    throw new ApiError(
      'No pudimos conectar con la academia. Verifica la URL, Internet, HTTPS y el plugin ATORA LMS.',
      0,
      'network_error',
    );
  } finally {
    clearTimeout(timeout);
  }
}
