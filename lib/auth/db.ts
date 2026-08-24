import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Local SQLite store. The app is single-user-on-your-laptop, so a file next to
 * the project beats standing up a database server. The file holds password
 * hashes and session tokens, so it stays out of git.
 */
/** Read at first use, not at import, so the path can be set at runtime. */
const dbPath = () =>
  process.env.DATABASE_PATH || join(process.cwd(), '.data', 'can-ai.db');

let db: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (db) return db;

  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      -- NULL for Google-only accounts, which never set a password.
      password_hash TEXT,
      google_id     TEXT UNIQUE,
      avatar_url    TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      -- Version of the terms the user accepted at signup, for the record.
      accepted_terms TEXT,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash  TEXT NOT NULL,
      purpose    TEXT NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      consumed   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_codes_user ON verification_codes(user_id, purpose);
  `);

  // Databases created before the column existed need it added in place.
  const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!columns.some((column) => column.name === 'accepted_terms')) {
    db.exec('ALTER TABLE users ADD COLUMN accepted_terms TEXT');
  }

  return db;
};

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  google_id: string | null;
  avatar_url: string | null;
  email_verified: number;
  accepted_terms: string | null;
  created_at: string;
}

/** Emails are matched case-insensitively; store them lowercased. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const findUserByEmail = (email: string): UserRow | undefined =>
  getDb()
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(normalizeEmail(email)) as UserRow | undefined;

export const findUserById = (id: string): UserRow | undefined =>
  getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;

export const findUserByGoogleId = (googleId: string): UserRow | undefined =>
  getDb()
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .get(googleId) as UserRow | undefined;

/** Remove expired sessions and codes. Cheap enough to run on each auth call. */
export const pruneExpired = (): void => {
  const now = new Date().toISOString();
  getDb().prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  getDb().prepare('DELETE FROM verification_codes WHERE expires_at < ?').run(now);
};
