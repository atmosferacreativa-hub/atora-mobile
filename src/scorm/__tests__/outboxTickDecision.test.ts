import { decideScormOutboxTick } from '../outboxTickDecision';

describe('scorm/outboxTickDecision', () => {
  it('when offline: remembers that there were pending events', () => {
    const first = decideScormOutboxTick({ online: false, pendingCount: 2, hadPending: false });
    expect(first).toEqual({ hadPending: true, shouldFlush: false, shouldRefreshServerState: false });
  });

  it('when online with pending: flushes and refreshes', () => {
    const out = decideScormOutboxTick({ online: true, pendingCount: 1, hadPending: false });
    expect(out).toEqual({ hadPending: true, shouldFlush: true, shouldRefreshServerState: true });
  });

  it('when queue drained by other flusher: refreshes once', () => {
    const out = decideScormOutboxTick({ online: true, pendingCount: 0, hadPending: true });
    expect(out).toEqual({ hadPending: false, shouldFlush: false, shouldRefreshServerState: true });
  });

  it('steady state: no flush, no refresh', () => {
    const out = decideScormOutboxTick({ online: true, pendingCount: 0, hadPending: false });
    expect(out).toEqual({ hadPending: false, shouldFlush: false, shouldRefreshServerState: false });
  });
});

