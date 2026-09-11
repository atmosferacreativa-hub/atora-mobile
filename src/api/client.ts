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
        payload?.message ?? 'No fue posible completar la solicitud.',
        response.status,
        payload?.code,
      );
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}
