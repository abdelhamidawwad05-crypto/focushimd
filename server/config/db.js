const path = require('path');
const fs = require('fs');

let db;

// ---------------------------------------------------------------------------
// Database choice: we reuse the SAME database already configured in this
// project (no new service). Locally (no DATABASE_URL) it is SQLite via
// node:sqlite in server/focus-himd.db. In production (Render, DATABASE_URL
// set) it is Postgres via pg (Neon/Supabase/Render). Same file, same tables.
// ---------------------------------------------------------------------------

if (process.env.DATABASE_URL) {
  // Production: Postgres (Render/Neon/Supabase)
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  // NOTE: every value below goes through $1-style placeholders in the route
  // handlers (parameterized queries) so user input can never alter the SQL.
  pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      duration INTEGER NOT NULL,
      mood TEXT NOT NULL CHECK (mood IN ('good','okay','rough')),
      note TEXT DEFAULT '',
      completedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_completedAt ON sessions(completedAt DESC);

    -- Persistent user accounts (one row per signup)
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      verified BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    -- Email verification codes: hashed, expiring, single-use
    CREATE TABLE IF NOT EXISTS verification_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_vcodes_user ON verification_codes(user_id);
  `).catch(e => console.error('PG init error', e.message));

  db = {
    type: 'pg',
    pool,
    prepare: () => { throw new Error('Use pool directly for pg'); }
  };
  console.log('📦 Using Postgres');
} else {
  // Local dev: SQLite via node:sqlite
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.join(__dirname, '..', 'focus-himd.db');
  const legacyPath = path.join(__dirname, 'focus-himd.db');
  try {
    if (fs.existsSync(legacyPath) && !fs.existsSync(dbPath)) {
      fs.copyFileSync(legacyPath, dbPath);
      console.log(`📦 Migrated DB from ${legacyPath} to ${dbPath}`);
    }
  } catch (e) {}
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      duration INTEGER NOT NULL,
      mood TEXT NOT NULL CHECK (mood IN ('good','okay','rough')),
      note TEXT DEFAULT '',
      completedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_completedAt ON sessions(completedAt DESC);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vcodes_user ON verification_codes(user_id);
  `);
  db = sqlite;
  db.type = 'sqlite';
  console.log('📦 Using SQLite:', dbPath);
}

module.exports = db;
