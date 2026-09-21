import { ApiError, apiRequest } from './client';
import { refreshAccessToken } from './session';

type RequestOptions = RequestInit & { token?: string };

export async function authenticatedRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    return await apiRequest<T>(path, options);
  } catch (reason) {
    if (!(reason instanceof ApiError)) throw reason;
    if (reason.status !== 401 || !options.token) throw reason;

    const refreshed = await refreshAccessToken();
    if (!refreshed) throw reason;

    return apiRequest<T>(path, { ...options, token: refreshed });
  }
}

