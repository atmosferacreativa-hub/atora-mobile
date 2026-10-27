export type DownloadBlockedCode = 'wifi_only' | 'quota' | 'no_space';

/** Error tipado para bloquear descargas sin depender del texto del mensaje. */
export class DownloadBlockedError extends Error {
  readonly code: DownloadBlockedCode;

  constructor(code: DownloadBlockedCode, message: string) {
    super(message);
    this.name = 'DownloadBlockedError';
    this.code = code;
  }
}

export function isDownloadBlockedError(reason: unknown): reason is DownloadBlockedError {
  return reason instanceof DownloadBlockedError;
}

