/**
 * 1.0.1 (plugin 6.33.2): la lectura de una entrega espera a un guardado en
 * curso; si no lo logra, el servidor responde 409 `atora_grade_busy`
 * (reintentable). Se reintenta una sola vez, tras 1 s. Módulo puro, para Jest.
 */
export async function retryOnceIfBusy<T>(run: () => Promise<T>, sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<T> {
  try {
    return await run();
  } catch (reason) {
    const error = reason as { status?: unknown; code?: unknown } | null;
    if (error?.status !== 409 || error?.code !== 'atora_grade_busy') throw reason;
    await sleep(1000);
    return run();
  }
}
