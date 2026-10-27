import type { OutboxEvent, OutboxHandler } from '../offline/outbox/types';

export type ScormCommitOutboxPayload = {
  attemptId: number;
  values: Record<string, string>;
  deviceTime: string;
};

export function buildScormCommitBody(event: OutboxEvent<ScormCommitOutboxPayload>): {
  values: Record<string, string>;
  client_event_id: string;
  device_time: string;
} {
  const payload = event.payload as ScormCommitOutboxPayload;
  return {
    values: payload?.values ?? {},
    client_event_id: event.id,
    device_time: payload?.deviceTime || new Date().toISOString(),
  };
}

export function createScormCommitOutboxHandler(commit: (attemptId: number, body: ReturnType<typeof buildScormCommitBody>) => Promise<void>): OutboxHandler {
  return async (event) => {
    const payload = event.payload as ScormCommitOutboxPayload;
    const attemptId = Number(payload?.attemptId ?? 0);
    if (!attemptId) throw new Error('Falta attemptId');
    await commit(attemptId, buildScormCommitBody(event as OutboxEvent<ScormCommitOutboxPayload>));
  };
}

