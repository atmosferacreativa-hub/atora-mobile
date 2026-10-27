function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalizePath(pathname: string): string {
  const out: string[] = [];
  const segments = pathname.split('/').map(decodeSegment);
  for (const seg of segments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return `/${out.join('/')}`;
}

function filePathFromUrl(url: string): string | null {
  // No dependemos de `URL` (polyfill variable en React Native).
  const raw = String(url || '');
  if (!raw.startsWith('file://')) return null;
  // Quitar query/hash.
  const cut = raw.split('#')[0]?.split('?')[0] ?? '';
  const afterScheme = cut.slice('file://'.length);

  // file:///path  → /path
  // file://localhost/path → /path
  // file://path (raro) → /path
  if (afterScheme.startsWith('/')) {
    return normalizePath(afterScheme);
  }
  if (afterScheme.startsWith('localhost/')) {
    return normalizePath(`/${afterScheme.slice('localhost'.length)}`);
  }

  const slash = afterScheme.indexOf('/');
  if (slash === -1) return '/';
  return normalizePath(afterScheme.slice(slash));
}

/**
 * Acepta solo URLs file:// dentro del directorio base (terminado en "/").
 * Evita bypass por "..", "%2e%2e" y prefijos tipo "v1" vs "v10".
 */
export function isAllowedScormFileUrl(url: string, baseDirUri: string): boolean {
  const basePath = filePathFromUrl(baseDirUri);
  const targetPath = filePathFromUrl(url);
  if (!basePath || !targetPath) return false;

  const baseWithSlash = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const targetWithSlash = targetPath;
  return targetWithSlash === basePath || targetWithSlash.startsWith(baseWithSlash);
}

