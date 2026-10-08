/**
 * Cierre de sesión (0.4.1). Módulo puro: sin React Native, para Jest.
 *
 * La revocación en el servidor es "mejor esfuerzo": sin red, la sesión local se
 * borra igual y el token se guarda para revocarlo en el próximo inicio de
 * sesión con conexión. Nunca lanza: la pantalla siempre vuelve al inicio de sesión.
 */

export type LogoutDeps = {
  revoke(token: string): Promise<void>;
  /** true si el error significa que el token ya no sirve (no hay nada que revocar). */
  alreadyInvalid(reason: unknown): boolean;
  clearLocal(): Promise<void>;
  rememberForLater(token: string): Promise<void>;
};

export async function performLogout(token: string, deps: LogoutDeps): Promise<{ revoked: boolean }> {
  let revoked = false;
  try {
    await deps.revoke(token);
    revoked = true;
  } catch (reason) {
    if (deps.alreadyInvalid(reason)) {
      revoked = true;
    } else {
      await deps.rememberForLater(token).catch(() => undefined);
    }
  }
  await deps.clearLocal().catch(() => undefined);
  return { revoked };
}

export type PendingRevocationDeps = {
  list(): Promise<string[]>;
  save(tokens: string[]): Promise<void>;
  revoke(token: string): Promise<void>;
  alreadyInvalid(reason: unknown): boolean;
};

/** Tras un inicio de sesión con conexión: revoca lo que quedó pendiente; lo que vuelve a fallar se conserva. */
export async function revokePending(deps: PendingRevocationDeps): Promise<number> {
  const tokens = await deps.list().catch(() => [] as string[]);
  if (!tokens.length) return 0;
  const keep: string[] = [];
  let done = 0;
  for (const token of tokens) {
    try {
      await deps.revoke(token);
      done += 1;
    } catch (reason) {
      if (deps.alreadyInvalid(reason)) done += 1;
      else keep.push(token);
    }
  }
  await deps.save(keep).catch(() => undefined);
  return done;
}

/**
 * 1.0.0 (E.6): baja del teléfono en las notificaciones. Sin red queda pendiente
 * (con el token de la sesión que se cierra) y se envía cuando vuelve la red,
 * aunque ya no haya sesión en la app. El servidor (6.33.1) además borra los
 * tokens de una sesión al revocarla y no envía a sesiones revocadas.
 */
export type PendingDevice = { token: string; deviceId: number };

export type LogoutDeviceDeps = LogoutDeps & {
  unregister(item: PendingDevice): Promise<void>;
  rememberDevice(item: PendingDevice): Promise<void>;
};

/**
 * Cierre de sesión completo: baja del dispositivo (si lo hay, con el token de
 * acceso) y revocación (con el de renovación, que sigue valiendo si la red vuelve
 * tarde). Nunca lanza.
 */
export async function logoutDevice(tokens: { access: string; refresh: string }, deviceId: number | null, deps: LogoutDeviceDeps): Promise<{ revoked: boolean }> {
  if (deviceId) {
    const item = { token: tokens.access, deviceId };
    try {
      await deps.unregister(item);
    } catch (reason) {
      if (!deps.alreadyInvalid(reason)) await deps.rememberDevice(item).catch(() => undefined);
    }
  }
  return performLogout(tokens.refresh, deps);
}

export type FlushPendingDeps = {
  unregister(item: PendingDevice): Promise<void>;
  revoke(token: string): Promise<void>;
  alreadyInvalid(reason: unknown): boolean;
  listDevices(): Promise<PendingDevice[]>;
  saveDevices(items: PendingDevice[]): Promise<void>;
  listRevocations(): Promise<string[]>;
  saveRevocations(tokens: string[]): Promise<void>;
};

/**
 * Al volver la red (con o sin sesión): primero las bajas de dispositivos (con el
 * token aún válido) y después las revocaciones. Lo que vuelve a fallar se conserva.
 */
export async function flushPendingLogout(deps: FlushPendingDeps): Promise<{ devices: number; revocations: number }> {
  const items = await deps.listDevices().catch(() => [] as PendingDevice[]);
  const keep: PendingDevice[] = [];
  let devices = 0;
  for (const item of items) {
    try {
      await deps.unregister(item);
      devices += 1;
    } catch (reason) {
      if (deps.alreadyInvalid(reason)) devices += 1;
      else keep.push(item);
    }
  }
  if (items.length) await deps.saveDevices(keep).catch(() => undefined);
  const revocations = await revokePending({ list: deps.listRevocations, save: deps.saveRevocations, revoke: deps.revoke, alreadyInvalid: deps.alreadyInvalid });
  return { devices, revocations };
}
