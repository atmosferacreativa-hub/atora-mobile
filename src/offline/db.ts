import * as SQLite from 'expo-sqlite';

/**
 * Base local de la app (0.3.0). Todo dato lleva user_id; al cerrar sesión se
 * borra entero (purgeLocalDb), así no queda nada del usuario anterior.
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_VERSION = 2;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('atora.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cache (
        user_id    INTEGER NOT NULL,
        kind       TEXT    NOT NULL,
        entity_id  INTEGER NOT NULL,
        payload    TEXT    NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, kind, entity_id)
      );
      CREATE TABLE IF NOT EXISTS outbox (
        id              TEXT    PRIMARY KEY,
        user_id         INTEGER NOT NULL,
        type            TEXT    NOT NULL,
        dedupe_key      TEXT    NOT NULL,
        payload         TEXT    NOT NULL,
        status          TEXT    NOT NULL,
        attempts        INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL,
        created_at      INTEGER NOT NULL,
        last_error      TEXT    NOT NULL DEFAULT '',
        UNIQUE (user_id, dedupe_key)
      );
      CREATE INDEX IF NOT EXISTS outbox_user_created ON outbox (user_id, created_at);
      PRAGMA user_version = 1;
    `);
  }
  if ((row?.user_version ?? 0) < 2) {
    // 0.4.0: sincronización incremental (cursor y revisión local de cada curso y lección).
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_state (
        user_id   INTEGER PRIMARY KEY,
        cursor    TEXT    NOT NULL DEFAULT '',
        synced_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS sync_index (
        user_id   INTEGER NOT NULL,
        kind      TEXT    NOT NULL,
        entity_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL DEFAULT 0,
        revision  INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, kind, entity_id)
      );
      PRAGMA user_version = ${SCHEMA_VERSION};
    `);
  }
  return db;
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = open().catch((reason) => {
      dbPromise = null;
      throw reason;
    });
  }
  return dbPromise;
}

export async function purgeLocalDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM cache; DELETE FROM outbox; DELETE FROM sync_state; DELETE FROM sync_index;');
}
