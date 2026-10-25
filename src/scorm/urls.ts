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
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') return null;
    // URL.pathname viene con escapes; normalizamos por segmentos para resolver
    // `..` y variantes percent-encoded (p. ej. %2e%2e).
    return normalizePath(parsed.pathname);
  } catch {
    return null;
  }
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

