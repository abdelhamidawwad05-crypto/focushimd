const path = require('path');
const fs = require('fs');

let db;

if (process.env.DATABASE_URL) {
  // Production: Postgres (Render/Neon/Supabase)
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      duration INTEGER NOT NULL,
      mood TEXT NOT NULL CHECK (mood IN ('good','okay','rough')),
      note TEXT DEFAULT '',
      completedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_completedAt ON sessions(completedAt DESC);
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
  `);
  db = sqlite;
  db.type = 'sqlite';
  console.log('📦 Using SQLite:', dbPath);
}

module.exports = db;
