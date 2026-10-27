export type ScormOutboxTickDecision = {
  hadPending: boolean;
  shouldFlush: boolean;
  shouldRefreshServerState: boolean;
};

/**
 * Decide qué hacer en un tick del player SCORM respecto a la cola offline.
 *
 * Objetivo: si un commit se encola sin red y luego otro worker/flusher vacía
 * la cola, el player igual debe refrescar el estado del servidor 1 vez.
 */
export function decideScormOutboxTick(params: {
  online: boolean;
  pendingCount: number;
  hadPending: boolean;
}): ScormOutboxTickDecision {
  const nextHadPending = params.hadPending || params.pendingCount > 0;
  if (!params.online) {
    return { hadPending: nextHadPending, shouldFlush: false, shouldRefreshServerState: false };
  }

  if (params.pendingCount > 0) {
    return { hadPending: true, shouldFlush: true, shouldRefreshServerState: true };
  }

  if (params.hadPending) {
    return { hadPending: false, shouldFlush: false, shouldRefreshServerState: true };
  }

  return { hadPending: false, shouldFlush: false, shouldRefreshServerState: false };
}

