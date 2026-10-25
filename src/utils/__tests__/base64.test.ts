import { randomBytes } from 'crypto';
import { base64ToBytes, bytesToBase64 } from '../base64';

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

describe('base64 codec', () => {
  it('ida y vuelta: bytes aleatorios (incluye longitudes no múltiplos de 3)', () => {
    const sizes = [
      0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13,
      15, 16, 31, 32, 33, 63, 64, 65, 127, 128, 129,
      255, 256, 257, 1024,
    ];
    for (const size of sizes) {
      const buf = randomBytes(size);
      const encoded = bytesToBase64(new Uint8Array(buf));
      expect(encoded).toBe(buf.toString('base64'));
      const decoded = base64ToBytes(encoded);
      expect(toHex(decoded)).toBe(buf.toString('hex'));
    }
  });

  it('cubre 0x00-0xFF completo', () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) bytes[i] = i;
    const encoded = bytesToBase64(bytes);
    expect(encoded).toBe(Buffer.from(bytes).toString('base64'));
    const decoded = base64ToBytes(encoded);
    expect(toHex(decoded)).toBe(Buffer.from(bytes).toString('hex'));
  });

  it('decodifica base64 generado por Buffer', () => {
    const buf = randomBytes(777);
    const encoded = buf.toString('base64');
    const decoded = base64ToBytes(encoded);
    expect(toHex(decoded)).toBe(buf.toString('hex'));
  });
});

