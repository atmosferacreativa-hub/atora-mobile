import { mergeScormValues } from '../values';

describe('mergeScormValues', () => {
  it('server gana ante conflicto y mantiene lo local', () => {
    expect(mergeScormValues(
      { a: 'local', b: 'only-local' },
      { a: 'server', c: 'only-server' },
    )).toEqual({ a: 'server', b: 'only-local', c: 'only-server' });
  });

  it('sin server: devuelve copia de lo local', () => {
    const local = { a: '1' };
    const merged = mergeScormValues(local, null);
    expect(merged).toEqual({ a: '1' });
    expect(merged).not.toBe(local);
  });
});

