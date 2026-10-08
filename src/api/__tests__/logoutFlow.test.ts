import { flushPendingLogout, logoutDevice, performLogout, revokePending, type LogoutDeps, type PendingDevice } from '../logoutFlow';

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

/**
 * 1.0.0 (E.6): cerrar sesión en modo avión y volver a tener red. El servidor
 * simulado borra los tokens de notificaciones de una sesión al revocarla (6.33.1)
 * y no envía a sesiones revocadas.
 */
describe('cerrar sesión sin red y reconectar: el servidor deja de enviar avisos', () => {
  function world() {
    const server = {
      sessions: new Map<string, boolean>([['acc-1', true]]),
      devices: new Map<number, { session: string; push: string }>([[7, { session: 'acc-1', push: 'ExponentPushToken[tel]' }]]),
      pushesTo(): string[] {
        return [...this.devices.values()].filter((d) => this.sessions.get(d.session)).map((d) => d.push);
      },
    };
    let online = true;
    const offline = () => new HttpError(0);
    const storage = { revocations: [] as string[], devices: [] as PendingDevice[], cleared: false };
    const api = {
      revoke: async (token: string) => {
        if (!online) throw offline();
        if (!server.sessions.get(token)) throw new HttpError(401);
        server.sessions.set(token, false);
        for (const [id, d] of server.devices) if (d.session === token) server.devices.delete(id);
      },
      unregister: async (item: PendingDevice) => {
        if (!online) throw offline();
        if (!server.sessions.get(item.token)) throw new HttpError(401);
        server.devices.delete(item.deviceId);
      },
    };
    const alreadyInvalid = (reason: unknown) => reason instanceof HttpError && (reason.status === 401 || reason.status === 403);
    const deps = {
      ...api,
      alreadyInvalid,
      clearLocal: async () => { storage.cleared = true; },
      rememberForLater: async (token: string) => { storage.revocations.push(token); },
      rememberDevice: async (item: PendingDevice) => { storage.devices.push(item); },
      listRevocations: async () => storage.revocations,
      saveRevocations: async (tokens: string[]) => { storage.revocations = tokens; },
      listDevices: async () => storage.devices,
      saveDevices: async (items: PendingDevice[]) => { storage.devices = items; },
    };
    return { server, storage, deps, setOnline: (value: boolean) => { online = value; } };
  }

  it('en modo avión queda pendiente; al volver la red (sin sesión) se envía y el servidor ya no tiene el token', async () => {
    const { server, storage, deps, setOnline } = world();
    setOnline(false);
    await logoutDevice({ access: 'acc-1', refresh: 'acc-1' }, 7, deps);
    expect(storage.cleared).toBe(true);
    expect(storage.devices).toEqual([{ token: 'acc-1', deviceId: 7 }]);
    expect(storage.revocations).toEqual(['acc-1']);
    expect(server.pushesTo()).toEqual(['ExponentPushToken[tel]']); // todavía no se enteró

    setOnline(true);
    const done = await flushPendingLogout(deps); // sin sesión en la app
    expect(done).toEqual({ devices: 1, revocations: 1 });
    expect(server.devices.size).toBe(0);
    expect(server.sessions.get('acc-1')).toBe(false);
    expect(server.pushesTo()).toEqual([]);
    expect(storage.devices).toEqual([]);
    expect(storage.revocations).toEqual([]);
  });

  it('si la red vuelve a caer a mitad, lo que falló se conserva para el próximo intento', async () => {
    const { storage, deps, setOnline } = world();
    setOnline(false);
    await logoutDevice({ access: 'acc-1', refresh: 'acc-1' }, 7, deps);
    expect(await flushPendingLogout(deps)).toEqual({ devices: 0, revocations: 0 });
    expect(storage.devices).toHaveLength(1);
    expect(storage.revocations).toHaveLength(1);
  });

  it('con red: se da de baja y se revoca en el momento, sin pendientes', async () => {
    const { server, storage, deps } = world();
    await logoutDevice({ access: 'acc-1', refresh: 'acc-1' }, 7, deps);
    expect(server.pushesTo()).toEqual([]);
    expect(storage.devices).toEqual([]);
    expect(storage.revocations).toEqual([]);
  });
});

