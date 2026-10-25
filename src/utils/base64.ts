const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Map(Array.from(B64).map((c, i) => [c, i] as const));

export function base64ToBytes(base64: string): Uint8Array {
  const clean = String(base64 || '').replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);

  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const len = clean.length;
  const outLen = Math.max(0, Math.floor((len * 3) / 4) - pad);
  const out = new Uint8Array(outLen);
  let oi = 0;

  for (let i = 0; i < len; i += 4) {
    const c0 = clean[i];
    const c1 = clean[i + 1];
    const c2 = clean[i + 2];
    const c3 = clean[i + 3];
    if (!c0 || !c1) break;
    const b0 = B64_LOOKUP.get(c0);
    const b1 = B64_LOOKUP.get(c1);
    const b2 = c2 === '=' || !c2 ? undefined : B64_LOOKUP.get(c2);
    const b3 = c3 === '=' || !c3 ? undefined : B64_LOOKUP.get(c3);
    if (b0 === undefined || b1 === undefined || (c2 !== '=' && c2 && b2 === undefined) || (c3 !== '=' && c3 && b3 === undefined)) {
      throw new Error('invalid base64');
    }

    const x = (b0 << 18) | (b1 << 12) | ((b2 ?? 0) << 6) | (b3 ?? 0);
    if (oi < outLen) out[oi++] = (x >> 16) & 0xff;
    if (oi < outLen && c2 !== '=') out[oi++] = (x >> 8) & 0xff;
    if (oi < outLen && c3 !== '=') out[oi++] = x & 0xff;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const x = (a << 16) | (b << 8) | c;
    out += B64.charAt((x >> 18) & 63)
      + B64.charAt((x >> 12) & 63)
      + (i + 1 < bytes.length ? B64.charAt((x >> 6) & 63) : '=')
      + (i + 2 < bytes.length ? B64.charAt(x & 63) : '=');
  }
  return out;
}

