/**
 * Cola única de eventos salientes (outbox). Módulo puro: sin React Native,
 * para poder probarlo con Jest.
 */

export type OutboxStatus = 'pending' | 'failed';

export type OutboxEvent<P = unknown> = {
  /** client_event_id: estable entre reintentos. */
  id: string;
  userId: number;
  type: string;
  /** Dos eventos con la misma clave no se duplican (p. ej. completar la misma lección). */
  dedupeKey: string;
  payload: P;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  lastError: string;
};

export type EnqueueInput<P = unknown> = {
  id: string;
  userId: number;
  type: string;
  dedupeKey: string;
  payload: P;
  createdAt?: number;
};

export interface OutboxStore {
  /** Devuelve false si ya existe un evento con el mismo (userId, dedupeKey). */
  insert(event: OutboxEvent): Promise<boolean>;
  findByDedupe(userId: number, dedupeKey: string): Promise<OutboxEvent | null>;
  /** Eventos del usuario, del más antiguo al más reciente. */
  list(userId: number): Promise<OutboxEvent[]>;
  update(id: string, patch: Partial<OutboxEvent>): Promise<void>;
  remove(id: string): Promise<void>;
}

/** retry: red/5xx/429 · definitive: 4xx (403, 409, 422…) · auth: 401 sin renovación. */
export type ErrorClass = 'retry' | 'definitive' | 'auth';

export type HandlerContext<P> = {
  /** Guarda progreso parcial (p. ej. bytes ya subidos) antes de seguir. */
  save: (payload: P) => Promise<void>;
};

export type OutboxHandler<P = any> = (event: OutboxEvent<P>, context: HandlerContext<P>) => Promise<void>;

export type ProcessResult = { done: number; retried: number; failed: number; stoppedForAuth: boolean };
