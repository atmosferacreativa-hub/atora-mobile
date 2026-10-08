import { retryOnceIfBusy } from '../busyRetry';

const busy = Object.assign(new Error('Otro guardado de esta entrega está en curso.'), { status: 409, code: 'atora_grade_busy' });

describe('lectura de una entrega mientras otro guarda (plugin 6.33.2: 409 reintentable)', () => {
  it('reintenta una vez tras 1 s y devuelve la lectura', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const out = await retryOnceIfBusy(async () => { calls += 1; if (calls === 1) throw busy; return 'detalle'; }, async (ms) => { sleeps.push(ms); });
    expect(out).toBe('detalle');
    expect(calls).toBe(2);
    expect(sleeps).toEqual([1000]);
  });

  it('solo una vez: si sigue ocupado, el error llega a la pantalla', async () => {
    let calls = 0;
    await expect(retryOnceIfBusy(async () => { calls += 1; throw busy; }, async () => undefined)).rejects.toBe(busy);
    expect(calls).toBe(2);
  });

  it('otros errores (un 409 de revisión, 404, red) no se reintentan', async () => {
    const conflict = Object.assign(new Error('Conflicto'), { status: 409, code: 'atora_grade_revision_conflict' });
    let calls = 0;
    await expect(retryOnceIfBusy(async () => { calls += 1; throw conflict; }, async () => undefined)).rejects.toBe(conflict);
    expect(calls).toBe(1);
  });
});
