/**
 * Local Database — SQLite storage for offline-first data.
 *
 * Uses expo-sqlite for activity events, sync queue, preferences,
 * and coach conversation history.
 */

import * as SQLite from 'expo-sqlite';
import { createId } from '@/utils/id';

const DB_NAME = 'flowsight.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await initializeDatabase(db);
  }
  return db;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- Activity events (offline-first)
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      client_event_id TEXT NOT NULL UNIQUE,
      user_id TEXT,
      device_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_platform TEXT NOT NULL,
      capture_source TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      timezone TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      category TEXT NOT NULL,
      task_label TEXT,
      ticket_ref TEXT,
      description TEXT,
      confidence REAL NOT NULL DEFAULT 1.0,
      schema_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      expires_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_activity_events_start
      ON activity_events(start_at);
    CREATE INDEX IF NOT EXISTS idx_activity_events_synced
      ON activity_events(synced_at);

    -- Sync queue
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES activity_events(id),
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_status
      ON sync_queue(status);

    -- User preferences
    CREATE TABLE IF NOT EXISTS user_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Coach conversation history
    CREATE TABLE IF NOT EXISTS coach_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_coach_messages_created
      ON coach_messages(created_at);

    -- Session state (for timer recovery)
    CREATE TABLE IF NOT EXISTS active_session (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      category TEXT,
      task_label TEXT,
      ticket_ref TEXT,
      paused_at TEXT,
      accumulated_seconds INTEGER NOT NULL DEFAULT 0
    );
  `);

  const columns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(activity_events)'
  );
  if (!columns.some((column) => column.name === 'pause_count')) {
    await database.execAsync(
      'ALTER TABLE activity_events ADD COLUMN pause_count INTEGER NOT NULL DEFAULT 0'
    );
  }

  const sessionColumns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(active_session)'
  );
  if (!sessionColumns.some((column) => column.name === 'pause_count')) {
    await database.execAsync(
      'ALTER TABLE active_session ADD COLUMN pause_count INTEGER NOT NULL DEFAULT 0'
    );
  }
}

// ─── Activity Events ──────────────────────────────────────────────────────────

export async function insertActivityEvent(event: {
  id: string;
  client_event_id: string;
  user_id?: string;
  device_id: string;
  source: string;
  source_platform: string;
  capture_source: string;
  start_at: string;
  end_at: string;
  timezone: string;
  duration_seconds: number;
  category: string;
  task_label?: string | null;
  ticket_ref?: string | null;
  description?: string | null;
  confidence: number;
  pause_count?: number;
}) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR IGNORE INTO activity_events (
      id, client_event_id, user_id, device_id, source, source_platform,
      capture_source, start_at, end_at, timezone, duration_seconds,
      category, task_label, ticket_ref, description, confidence,
      pause_count, schema_version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      event.id, event.client_event_id, event.user_id ?? null,
      event.device_id, event.source, event.source_platform,
      event.capture_source, event.start_at, event.end_at,
      event.timezone, event.duration_seconds, event.category,
      event.task_label ?? null, event.ticket_ref ?? null,
      event.description ?? null, event.confidence,
      event.pause_count ?? 0, now, now,
    ]
  );

  const syncConsent = await getPreference('consent_cloud_sync');
  if (syncConsent === 'true') {
    await db.runAsync(
      `INSERT INTO sync_queue (id, event_id, status, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, ?)`,
      [createId(), event.id, now, now]
    );
  }
}

export async function getUnsyncedEvents(limit = 50) {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT ae.* FROM activity_events ae
     JOIN sync_queue sq ON sq.event_id = ae.id
     WHERE sq.status = 'pending'
     ORDER BY ae.start_at ASC
     LIMIT ?`,
    [limit]
  );
}

export async function markEventSynced(eventId: string) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'synced', updated_at = ? WHERE event_id = ?`,
    [now, eventId]
  );
  await db.runAsync(
    `UPDATE activity_events SET synced_at = ? WHERE id = ?`,
    [now, eventId]
  );
}

// ─── Preferences ──────────────────────────────────────────────────────────────

export async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM user_preferences WHERE key = ?`,
    [key]
  );
  return row?.value ?? null;
}

export async function setPreference(key: string, value: string) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)`,
    [key, value, now]
  );
}

// ─── Active Session (timer recovery) ──────────────────────────────────────────

export async function saveActiveSession(session: {
  id: string;
  started_at: string;
  category?: string;
  task_label?: string;
  ticket_ref?: string;
  paused_at?: string;
  accumulated_seconds: number;
  pause_count?: number;
}) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM active_session`);
  await db.runAsync(
    `INSERT INTO active_session (id, started_at, category, task_label, ticket_ref, paused_at, accumulated_seconds, pause_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.started_at, session.category ?? null,
     session.task_label ?? null, session.ticket_ref ?? null,
     session.paused_at ?? null, session.accumulated_seconds, session.pause_count ?? 0]
  );
}

export async function getActiveSession() {
  const db = await getDatabase();
  return db.getFirstAsync<{
    id: string;
    started_at: string;
    category: string | null;
    task_label: string | null;
    ticket_ref: string | null;
    paused_at: string | null;
    accumulated_seconds: number;
    pause_count: number;
  }>(`SELECT * FROM active_session LIMIT 1`);
}

export async function clearActiveSession() {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM active_session`);
}

// ─── Coach Messages ───────────────────────────────────────────────────────────

export async function saveCoachMessage(message: {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.runAsync(
    `INSERT INTO coach_messages (id, role, content, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [message.id, message.role, message.content, now, expiresAt]
  );
}

export async function getCoachHistory(limit = 12) {
  const db = await getDatabase();
  return db.getAllAsync<{ role: string; content: string }>(
    `SELECT role, content FROM coach_messages
     WHERE expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export async function cleanupExpiredCoachMessages() {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM coach_messages WHERE expires_at < datetime('now')`
  );
}

// ─── Daily Stats ──────────────────────────────────────────────────────────────

export async function getDailyStats(date: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    category: string;
    total_seconds: number;
    session_count: number;
  }>(
    `SELECT category,
            SUM(duration_seconds) as total_seconds,
            COUNT(*) as session_count
     FROM activity_events
     WHERE date(start_at) = ?
     GROUP BY category
     ORDER BY total_seconds DESC`,
    [date]
  );

  const totalSeconds = rows.reduce((sum, r) => sum + r.total_seconds, 0);
  return { rows, totalSeconds };
}

export async function getWeeklyStats(startDate: string, endDate: string) {
  const db = await getDatabase();
  return db.getAllAsync<{
    date: string;
    total_seconds: number;
  }>(
    `SELECT date(start_at) as date,
            SUM(duration_seconds) as total_seconds
     FROM activity_events
     WHERE start_at >= ? AND start_at < ?
     GROUP BY date(start_at)
     ORDER BY date ASC`,
    [startDate, endDate]
  );
}

export async function getRecentSessions(limit = 14) {
  const db = await getDatabase();
  return db.getAllAsync<{
    id: string;
    start_at: string;
    end_at: string;
    duration_seconds: number;
    pause_count: number;
  }>(
    `SELECT id, start_at, end_at, duration_seconds, COALESCE(pause_count, 0) as pause_count
     FROM activity_events
     ORDER BY start_at DESC
     LIMIT ?`,
    [limit]
  );
}
