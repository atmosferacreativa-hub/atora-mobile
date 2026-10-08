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

export type PendingRevocationDeps<T = string> = {
  list(): Promise<T[]>;
  save(items: T[]): Promise<void>;
  revoke(item: T): Promise<void>;
  alreadyInvalid(reason: unknown): boolean;
};

/** Revoca lo que quedó pendiente; lo que vuelve a fallar por la red se conserva. */
export async function revokePending<T>(deps: PendingRevocationDeps<T>): Promise<number> {
  const items = await deps.list().catch(() => [] as T[]);
  if (!items.length) return 0;
  const keep: T[] = [];
  let done = 0;
  for (const item of items) {
    try {
      await deps.revoke(item);
      done += 1;
    } catch (reason) {
      if (deps.alreadyInvalid(reason)) done += 1;
      else keep.push(item);
    }
  }
  await deps.save(keep).catch(() => undefined);
  return done;
}

/**
 * 1.0.0 (E.6): baja del teléfono en las notificaciones. Sin red queda pendiente
 * y se envía cuando vuelve la red, aunque ya no haya sesión en la app. El
 * servidor (6.33.1) además borra los tokens de una sesión al revocarla.
 *
 * 1.0.1: cada pendiente lleva la URL de su academia (`academy`) y solo se envía
 * a esa academia: nunca llegan credenciales de una academia a otra. Los
 * pendientes viejos, sin academia, se descartan sin enviarse.
 */
export type PendingRevocation = { token: string; academy: string };
export type PendingDevice = { token: string; deviceId: number; academy: string };

export type LogoutDeviceDeps = LogoutDeps & {
  unregister(item: { token: string; deviceId: number }): Promise<void>;
  rememberDevice(item: { token: string; deviceId: number }): Promise<void>;
};

/**
 * Cierre de sesión completo: baja del dispositivo (si lo hay, con el token de
 * acceso) y revocación (con el de renovación, que sigue valiendo si la red vuelve
 * tarde). Nunca lanza. Quien guarda los pendientes les agrega la academia actual.
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

/** Solo los pendientes con su academia (los de versiones anteriores no la tienen y se descartan). */
export function withAcademy<T extends { academy?: unknown }>(items: unknown[]): T[] {
  return items.filter((item): item is T => typeof item === 'object' && item !== null && typeof (item as { token?: unknown }).token === 'string' && typeof (item as { academy?: unknown }).academy === 'string' && (item as { academy: string }).academy !== '');
}

export type FlushPendingDeps = {
  /** Envía a `item.academy`, nunca a la academia configurada ahora. */
  unregister(item: PendingDevice): Promise<void>;
  revoke(item: PendingRevocation): Promise<void>;
  alreadyInvalid(reason: unknown): boolean;
  listDevices(): Promise<PendingDevice[]>;
  saveDevices(items: PendingDevice[]): Promise<void>;
  listRevocations(): Promise<PendingRevocation[]>;
  saveRevocations(items: PendingRevocation[]): Promise<void>;
};

/**
 * Al volver la red (con o sin sesión): primero las bajas de dispositivos (con el
 * token aún válido) y después las revocaciones, cada una a su academia. Un 401
 * de esa academia descarta el pendiente; un error de red lo conserva.
 */
export async function flushPendingLogout(deps: FlushPendingDeps): Promise<{ devices: number; revocations: number }> {
  const devices = await revokePending<PendingDevice>({ list: deps.listDevices, save: deps.saveDevices, revoke: deps.unregister, alreadyInvalid: deps.alreadyInvalid });
  const revocations = await revokePending<PendingRevocation>({ list: deps.listRevocations, save: deps.saveRevocations, revoke: deps.revoke, alreadyInvalid: deps.alreadyInvalid });
  return { devices, revocations };
}
