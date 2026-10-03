import { getDb } from '../db';
import type { OutboxEvent, OutboxStore } from './types';

type Row = {
  id: string;
  user_id: number;
  type: string;
  dedupe_key: string;
  payload: string;
  status: string;
  attempts: number;
  next_attempt_at: number;
  created_at: number;
  last_error: string;
};

function toEvent(row: Row): OutboxEvent {
  let payload: unknown = null;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    payload = null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    dedupeKey: row.dedupe_key,
    payload,
    status: row.status === 'failed' ? 'failed' : 'pending',
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    lastError: row.last_error,
  };
}

const COLUMNS: Record<keyof OutboxEvent, string> = {
  id: 'id',
  userId: 'user_id',
  type: 'type',
  dedupeKey: 'dedupe_key',
  payload: 'payload',
  status: 'status',
  attempts: 'attempts',
  nextAttemptAt: 'next_attempt_at',
  createdAt: 'created_at',
  lastError: 'last_error',
};

export const sqliteOutboxStore: OutboxStore = {
  async insert(event) {
    const db = await getDb();
    const result = await db.runAsync(
      `INSERT OR IGNORE INTO outbox (id, user_id, type, dedupe_key, payload, status, attempts, next_attempt_at, created_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      event.id, event.userId, event.type, event.dedupeKey, JSON.stringify(event.payload), event.status,
      event.attempts, event.nextAttemptAt, event.createdAt, event.lastError,
    );
    return result.changes === 1;
  },
  async findByDedupe(userId, dedupeKey) {
    const db = await getDb();
    const row = await db.getFirstAsync<Row>('SELECT * FROM outbox WHERE user_id = ? AND dedupe_key = ?', userId, dedupeKey);
    return row ? toEvent(row) : null;
  },
  async list(userId) {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>('SELECT * FROM outbox WHERE user_id = ? ORDER BY created_at ASC, id ASC', userId);
    return rows.map(toEvent);
  },
  async update(id, patch) {
    const entries = Object.entries(patch).filter(([key]) => key !== 'id') as [keyof OutboxEvent, unknown][];
    if (!entries.length) return;
    const db = await getDb();
    const sets = entries.map(([key]) => `${COLUMNS[key]} = ?`).join(', ');
    const values = entries.map(([key, value]) => (key === 'payload' ? JSON.stringify(value) : value)) as (string | number)[];
    await db.runAsync(`UPDATE outbox SET ${sets} WHERE id = ?`, ...values, id);
  },
  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
  },
};
