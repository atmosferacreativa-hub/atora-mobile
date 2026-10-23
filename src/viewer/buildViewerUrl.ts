export type ViewerKind = 'pdf' | 'image' | 'html';

export type ViewerUrlOptions = {
  openingText?: string;
  failedText?: string;
  initialZoom?: number;
};

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(5, value));
}

export function buildViewerUrl(kind: ViewerKind, viewerDir: string, localUri: string, options: ViewerUrlOptions = {}): string {
  if (kind === 'html') return localUri;
  const params = new URLSearchParams();
  params.set('file', localUri);
  if (kind === 'pdf') {
    if (options.openingText) params.set('opening', options.openingText);
    if (options.failedText) params.set('failed', options.failedText);
    if (options.initialZoom) params.set('z', String(clampZoom(options.initialZoom)));
  } else {
    if (options.initialZoom) params.set('z', String(clampZoom(options.initialZoom)));
  }
  const base = `${viewerDir}${kind}.html`;
  return `${base}?${params.toString()}`;
}

