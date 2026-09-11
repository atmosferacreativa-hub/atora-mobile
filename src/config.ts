const rawApiUrl = process.env.EXPO_PUBLIC_ATORA_API_URL ?? '';

export const config = {
  apiBaseUrl: rawApiUrl.replace(/\/$/, ''),
  requestTimeoutMs: 15000,
};

export const hasApiConfiguration = Boolean(config.apiBaseUrl);
