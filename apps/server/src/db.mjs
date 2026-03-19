import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

import { DB_PATH } from "./config.mjs";
import { createSalt, hashPassword } from "./auth.mjs";
import {
  applyProviderSecretsToState,
  hasProviderSecretPayload,
  stripProviderSecretsFromState
} from "./providerSecrets.mjs";
import { createDefaultState, normalizeStateSnapshot } from "./seedState.mjs";

const db = new Database(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_state (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT,
    task_id TEXT,
    mode TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    tag_ids_json TEXT NOT NULL,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    lesson_ids_json TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    mime TEXT NOT NULL,
    path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    extracted_text TEXT,
    processing_status TEXT NOT NULL DEFAULT 'ready'
  );

  CREATE TABLE IF NOT EXISTS material_chunks (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    keywords_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS calendar_sources (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    origin TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES calendar_sources(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_id TEXT,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT,
    location TEXT,
    description TEXT,
    course_hint TEXT,
    tags_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    responded_at TEXT
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS provider_secrets (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    api_key TEXT NOT NULL DEFAULT '',
    extra_headers_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, provider_id)
  );
`);

const parseJson = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const updateUserStateRow = db.prepare(`
  INSERT INTO user_state (user_id, state_json, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    state_json = excluded.state_json,
    updated_at = excluded.updated_at
`);
const upsertProviderSecretRow = db.prepare(`
  INSERT INTO provider_secrets (user_id, provider_id, api_key, extra_headers_json, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, provider_id) DO UPDATE SET
    api_key = excluded.api_key,
    extra_headers_json = excluded.extra_headers_json,
    updated_at = excluded.updated_at
`);
const deleteProviderSecretRow = db.prepare(
  `DELETE FROM provider_secrets WHERE user_id = ? AND provider_id = ?`
);
const getProviderSecretRows = db.prepare(
  `SELECT provider_id, api_key, extra_headers_json FROM provider_secrets WHERE user_id = ?`
);

export const getUserByUsername = db.prepare(
  `SELECT * FROM users WHERE lower(username) = lower(?)`
);
export const getUserById = db.prepare(`SELECT * FROM users WHERE id = ?`);
const getUserStateRow = db.prepare(`SELECT * FROM user_state WHERE user_id = ?`);

export const createUser = (username, password) => {
  const id = randomUUID();
  const salt = createSalt();
  const hash = hashPassword(password, salt);
  const createdAt = new Date().toISOString();
  const state = stripProviderSecretsFromState(createDefaultState(username));

  db.exec("BEGIN");

  try {
    db.prepare(
      `INSERT INTO users (id, username, password_salt, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, username, salt, hash, createdAt);

    updateUserStateRow.run(id, JSON.stringify(state), createdAt);

    for (const session of state.sessions) {
      db.prepare(
        `INSERT INTO focus_sessions
        (id, user_id, course_id, task_id, mode, duration_min, start_at, end_at, tag_ids_json, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        session.id,
        id,
        session.courseId ?? null,
        session.taskId ?? null,
        session.mode,
        session.durationMin,
        session.startAt,
        session.endAt,
        JSON.stringify(session.tagIds),
        session.note ?? null
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { id, username, created_at: createdAt };
};

export const getState = (userId) => {
  const row = getUserStateRow.get(userId);

  if (!row) {
    return null;
  }

  const parsed = parseJson(row.state_json, null);
  const normalized = normalizeStateSnapshot(parsed);

  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    updateUserStateRow.run(userId, JSON.stringify(normalized), new Date().toISOString());
  }

  return normalized;
};

export const getProviderSecrets = (userId) =>
  new Map(
    getProviderSecretRows.all(userId).map((row) => [
      row.provider_id,
      {
        apiKey: row.api_key || "",
        extraHeaders: parseJson(row.extra_headers_json, [])
      }
    ])
  );

export const getStateWithProviderSecrets = (userId) => {
  const state = getState(userId);

  if (!state) {
    return null;
  }

  return applyProviderSecretsToState(state, getProviderSecrets(userId));
};

export const setState = (userId, state) => {
  updateUserStateRow.run(
    userId,
    JSON.stringify(stripProviderSecretsFromState(state)),
    new Date().toISOString()
  );
};

export const upsertProviderSecret = (userId, providerId, secret) => {
  if (!hasProviderSecretPayload(secret)) {
    deleteProviderSecretRow.run(userId, providerId);
    return;
  }

  upsertProviderSecretRow.run(
    userId,
    providerId,
    secret.apiKey ?? "",
    JSON.stringify(secret.extraHeaders ?? []),
    new Date().toISOString()
  );
};

export const deleteProviderSecret = (userId, providerId) => {
  deleteProviderSecretRow.run(userId, providerId);
};

export const upsertSession = (userId, session) => {
  db.prepare(
    `INSERT INTO focus_sessions
      (id, user_id, course_id, task_id, mode, duration_min, start_at, end_at, tag_ids_json, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id = excluded.course_id,
        task_id = excluded.task_id,
        mode = excluded.mode,
        duration_min = excluded.duration_min,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        tag_ids_json = excluded.tag_ids_json,
        note = excluded.note`
  ).run(
    session.id,
    userId,
    session.courseId ?? null,
    session.taskId ?? null,
    session.mode,
    session.durationMin,
    session.startAt,
    session.endAt,
    JSON.stringify(session.tagIds ?? []),
    session.note ?? null
  );
};

export const addMaterialRow = (payload) => {
  db.prepare(
    `INSERT INTO materials
      (id, user_id, course_id, lesson_ids_json, name, kind, mime, path, size_bytes, created_at, tags_json, extracted_text, processing_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    payload.id,
    payload.userId,
    payload.courseId,
    JSON.stringify(payload.lessonIds ?? []),
    payload.name,
    payload.kind,
    payload.mime,
    payload.path,
    payload.sizeBytes,
    payload.createdAt,
    JSON.stringify(payload.tags ?? []),
    payload.extractedText ?? null,
    payload.processingStatus ?? "ready"
  );
};

export const replaceMaterialChunks = (materialId, userId, courseId, chunks) => {
  db.prepare(`DELETE FROM material_chunks WHERE material_id = ?`).run(materialId);

  const insert = db.prepare(
    `INSERT INTO material_chunks (id, material_id, user_id, course_id, chunk_index, text, keywords_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const chunk of chunks) {
    insert.run(
      randomUUID(),
      materialId,
      userId,
      courseId,
      chunk.index,
      chunk.text,
      JSON.stringify(chunk.keywords)
    );
  }
};

export const getMaterialById = db.prepare(`SELECT * FROM materials WHERE id = ? AND user_id = ?`);
export const getCourseChunks = db.prepare(
  `SELECT mc.*, m.name AS material_name, m.kind AS material_kind
   FROM material_chunks mc
   JOIN materials m ON m.id = mc.material_id
   WHERE mc.user_id = ? AND mc.course_id = ?`
);

export const createCalendarSource = (userId, name, kind, origin = null) => {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO calendar_sources (id, user_id, name, kind, origin, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, name, kind, origin, new Date().toISOString());
  return id;
};

export const getCalendarSourcesByName = db.prepare(
  `SELECT id FROM calendar_sources WHERE user_id = ? AND name = ? AND kind = ? AND ifnull(origin, '') = ifnull(?, '')`
);
export const deleteCalendarSource = db.prepare(`DELETE FROM calendar_sources WHERE id = ?`);
export const clearCalendarSourceEvents = db.prepare(`DELETE FROM calendar_events WHERE source_id = ?`);
export const insertCalendarEvent = db.prepare(
  `INSERT INTO calendar_events
   (id, source_id, user_id, external_id, title, start_at, end_at, location, description, course_hint, tags_json)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
export const getCalendarEvents = db.prepare(
  `SELECT * FROM calendar_events WHERE user_id = ? ORDER BY start_at ASC`
);

export const createFriendRequest = (requesterId, targetId) => {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO friendships (id, requester_user_id, target_user_id, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`
  ).run(id, requesterId, targetId, new Date().toISOString());
  return id;
};

export const acceptFriendRequest = db.prepare(
  `UPDATE friendships SET status = 'accepted', responded_at = ? WHERE id = ?`
);

export const getFriendshipsForUser = db.prepare(
  `SELECT
      f.*,
      requester.username AS requester_username,
      target.username AS target_username
   FROM friendships f
   JOIN users requester ON requester.id = f.requester_user_id
   JOIN users target ON target.id = f.target_user_id
   WHERE f.requester_user_id = ? OR f.target_user_id = ?
   ORDER BY f.created_at DESC`
);

export const insertChatMessage = db.prepare(
  `INSERT INTO chat_messages
   (id, user_id, course_id, thread_id, role, content, citations_json, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
export const getChatMessages = db.prepare(
  `SELECT * FROM chat_messages WHERE user_id = ? AND course_id = ? AND thread_id = ? ORDER BY created_at ASC`
);
export const getChatThreads = db.prepare(
  `SELECT thread_id, max(created_at) AS last_activity_at
   FROM chat_messages
   WHERE user_id = ? AND course_id = ?
   GROUP BY thread_id
   ORDER BY last_activity_at DESC`
);

export const allFocusSessionsForUsers = db.prepare(
  `SELECT * FROM focus_sessions WHERE user_id IN (SELECT value FROM json_each(?))`
);

export const database = db;
export const json = (value) => JSON.stringify(value);
export const fromJson = parseJson;
