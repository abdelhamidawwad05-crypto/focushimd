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
  const schemaReady = pool.query(`
     -- Persistent user accounts (one row per signup)
     CREATE TABLE IF NOT EXISTS users (
       id SERIAL PRIMARY KEY,
       email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      verified BOOLEAN NOT NULL DEFAULT FALSE
     );
     CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

     -- A session belongs to exactly one authenticated user. The nullable
     -- migration below preserves old rows but they remain inaccessible until
     -- explicitly assigned; new rows always receive user_id from req.user.id.
     CREATE TABLE IF NOT EXISTS sessions (
       id SERIAL PRIMARY KEY,
       user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       duration INTEGER NOT NULL,
       mood TEXT NOT NULL CHECK (mood IN ('good','okay','rough')),
       note TEXT DEFAULT '',
       completedat TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     -- Older deployments declared completedAt without quotes, which Postgres
     -- stored as completedat. Handle the opposite legacy spelling too.
     DO $$
     BEGIN
       IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'completedAt')
          AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'completedat') THEN
         ALTER TABLE sessions RENAME COLUMN "completedAt" TO completedat;
       END IF;
     END $$;
     ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
     CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
     CREATE INDEX IF NOT EXISTS idx_completedat ON sessions(completedat DESC);

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
  `).then(() => console.log('✅ Postgres schema ready')).catch(e => {
    console.error('PG init error', e.message);
    throw e;
  });

  db = {
    type: 'pg',
    pool,
    ready: schemaReady,
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
     PRAGMA foreign_keys = ON;

     -- Persistent user accounts (one row per signup)
     CREATE TABLE IF NOT EXISTS users (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       email TEXT NOT NULL UNIQUE,
       password_hash TEXT NOT NULL,
       created_at TEXT NOT NULL,
       verified INTEGER NOT NULL DEFAULT 0
     );
     CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

     CREATE TABLE IF NOT EXISTS sessions (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       duration INTEGER NOT NULL,
       mood TEXT NOT NULL CHECK (mood IN ('good','okay','rough')),
       note TEXT DEFAULT '',
       completedat TEXT NOT NULL
    );
     CREATE INDEX IF NOT EXISTS idx_completedat ON sessions(completedat DESC);

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
  // Existing SQLite databases predate per-user ownership. Keep those legacy
  // rows with user_id NULL so they cannot be shown to anybody, and require
  // user_id on every newly written row.
  const sessionColumns = sqlite.prepare('PRAGMA table_info(sessions)').all();
  if (!sessionColumns.some(c => c.name === 'user_id')) {
    sqlite.exec('ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
  }
  // Normalize the old local spelling to the same lowercase DB contract used
  // by PostgreSQL. Existing timestamp values are preserved by RENAME COLUMN.
  const refreshedSessionColumns = sqlite.prepare('PRAGMA table_info(sessions)').all();
  if (refreshedSessionColumns.some(c => c.name === 'completedAt') && !refreshedSessionColumns.some(c => c.name === 'completedat')) {
    sqlite.exec('ALTER TABLE sessions RENAME COLUMN completedAt TO completedat');
  }
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
  db = sqlite;
  db.type = 'sqlite';
  db.ready = Promise.resolve();
  console.log('📦 Using SQLite:', dbPath);
}

module.exports = db;
