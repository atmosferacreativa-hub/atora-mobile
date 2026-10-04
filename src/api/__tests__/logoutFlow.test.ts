import { performLogout, revokePending, type LogoutDeps } from '../logoutFlow';

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

function deps(revoke: (token: string) => Promise<void>) {
  const state = { cleared: false, remembered: [] as string[] };
  const d: LogoutDeps = {
    revoke,
    alreadyInvalid: (reason) => reason instanceof HttpError && reason.status === 401,
    clearLocal: async () => { state.cleared = true; },
    rememberForLater: async (token) => { state.remembered.push(token); },
  };
  return { d, state };
}

describe('cierre de sesión', () => {
  it('sin red: borra la sesión, guarda el token y termina sin error', async () => {
    const { d, state } = deps(async () => { throw new TypeError('Network request failed'); });
    await expect(performLogout('tok-1', d)).resolves.toEqual({ revoked: false });
    expect(state.cleared).toBe(true);
    expect(state.remembered).toEqual(['tok-1']);
  });

  it('con red: revoca y no guarda nada', async () => {
    const { d, state } = deps(async () => undefined);
    await expect(performLogout('tok-1', d)).resolves.toEqual({ revoked: true });
    expect(state.cleared).toBe(true);
    expect(state.remembered).toEqual([]);
  });

  it('token ya inválido (401): no hay nada que revocar después', async () => {
    const { d, state } = deps(async () => { throw new HttpError(401); });
    await performLogout('tok-1', d);
    expect(state.remembered).toEqual([]);
  });

  it('al volver a entrar con red, revoca los pendientes y conserva los que fallan', async () => {
    let saved = ['viejo-1', 'viejo-2', 'viejo-3'];
    const done = await revokePending({
      list: async () => saved,
      save: async (tokens) => { saved = tokens; },
      revoke: async (token) => {
        if (token === 'viejo-2') throw new TypeError('Network request failed');
        if (token === 'viejo-3') throw new HttpError(401);
      },
      alreadyInvalid: (reason) => reason instanceof HttpError && reason.status === 401,
    });
    expect(done).toBe(2);
    expect(saved).toEqual(['viejo-2']);
  });
});
