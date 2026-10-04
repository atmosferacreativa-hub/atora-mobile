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
