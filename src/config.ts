const rawApiUrl = process.env.EXPO_PUBLIC_ATORA_API_URL ?? '';

export const defaultApiBaseUrl = rawApiUrl.replace(/\/$/, '');

// Nota: `config.apiBaseUrl` puede actualizarse en runtime vía `runtimeConfig.ts`.
export const config = {
  apiBaseUrl: defaultApiBaseUrl,
  requestTimeoutMs: 15000,
};

export const hasApiConfiguration = Boolean(config.apiBaseUrl);
