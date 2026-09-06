const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { normalizeEmail, validatePassword, validateCode } = require('../utils/validation');
const { requireAuth, signSession, cookieOpts } = require('../middleware/auth');
const { issueCsrf, requireCsrf } = require('../middleware/csrf');
const { sendVerificationEmail } = require('../email/send');

const router = express.Router();
const isPg = () => db.type === 'pg';

// ---------------------------------------------------------------------------
// Rate limiting — plain language: without this, an attacker can try millions
// of passwords (brute force). express-rate-limit counts requests per IP and
// blocks the IP with HTTP 429 once the cap is hit. Login + signup are the
// strictest (5 attempts per 15 minutes) because they guard accounts.
// ---------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { message: 'Too many sign-in attempts, try again in 15 minutes' },
  standardHeaders: true, legacyHeaders: false
});
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { message: 'Too many sign-up attempts, try again in 15 minutes' },
  standardHeaders: true, legacyHeaders: false
});
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { message: 'Too many verification attempts, try again later' },
  standardHeaders: true, legacyHeaders: false
});
const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { message: 'Too many resend requests, try again later' },
  standardHeaders: true, legacyHeaders: false
});

// ---- tiny DB helpers (both dialects; ALL values parameterized: $1 / ?) ----
async function findUserByEmail(email) {
  if (isPg()) {
    const r = await db.pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return r.rows[0] || null;
  }
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
}

async function findUserById(id) {
  if (isPg()) {
    const r = await db.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return r.rows[0] || null;
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

// Remove an account and its verification codes. Used to roll back a signup
// when the verification email could not be delivered, so the user can retry.
async function deleteUser(id) {
  if (isPg()) {
    await db.pool.query('DELETE FROM verification_codes WHERE user_id = $1', [id]);
    await db.pool.query('DELETE FROM users WHERE id = $1', [id]);
  } else {
    db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
}

// NEVER send these fields to the frontend (password hash, codes live here).
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    verified: isPg() ? !!u.verified : u.verified === 1,
    createdAt: u.created_at || u.createdAt
  };
}

function nowIso() { return new Date().toISOString(); }
function boolOut(v) { return isPg() ? !!v : v === 1; }

// Burn one code row (mark used) by id. Used to invalidate a code whose email
// could not be delivered, so a valid-but-undelivered code never lingers.
async function burnCodeRow(id) {
  if (isPg()) {
    await db.pool.query('UPDATE verification_codes SET used = TRUE WHERE id = $1', [id]);
  } else {
    db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(id);
  }
}

// Create a 6-digit code, store ONLY its bcrypt hash (10-min expiry,
// single-use), then DELIVER it via Brevo. Old unused codes are invalidated.
// Order matters: persist FIRST, then send. If the send fails, the just-created
// row is burned so a sent-but-unstored code (which could never validate) and
// a stored-but-unsent code (which the user never received) are both
// impossible. Delivery failure throws a tagged error so callers return a real
// failure to the frontend instead of a fake "check your email".
async function createVerificationCode(userId, email) {
  const code = String(crypto.randomInt(100000, 1000000)); // 6 digits
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const created = nowIso();

  let codeRowId;
  if (isPg()) {
    await db.pool.query('UPDATE verification_codes SET used = TRUE WHERE user_id = $1 AND used = FALSE', [userId]);
    const r = await db.pool.query(
      'INSERT INTO verification_codes (user_id, code_hash, expires_at, used, attempts, created_at) VALUES ($1,$2,$3,FALSE,0,$4) RETURNING id',
      [userId, codeHash, expiresAt, created]
    );
    codeRowId = r.rows[0].id;
  } else {
    db.prepare('UPDATE verification_codes SET used = 1 WHERE user_id = ? AND used = 0').run(userId);
    const r = db.prepare('INSERT INTO verification_codes (user_id, code_hash, expires_at, used, attempts, created_at) VALUES (?, ?, ?, 0, 0, ?)').run(userId, codeHash, expiresAt, created);
    codeRowId = Number(r.lastInsertRowid);
  }

  try {
    await sendVerificationEmail({ to: email, code });
  } catch (err) {
    try { await burnCodeRow(codeRowId); } catch (_) {}
    const e = new Error(`Verification email not delivered: ${err.message}`);
    e.isEmailDelivery = true;
    throw e;
  }
  return expiresAt;
}

const sqliteVerifyLocks = new Map();

async function withSqliteUserLock(userId, work) {
  const key = String(userId);
  const previous = sqliteVerifyLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  sqliteVerifyLocks.set(key, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (sqliteVerifyLocks.get(key) === current) sqliteVerifyLocks.delete(key);
  }
}

// Serialize verification attempts for one user. PostgreSQL uses a row lock
// inside a transaction; SQLite uses BEGIN IMMEDIATE. This keeps the read,
// bcrypt comparison, attempt increment, and code consumption one atomic unit.
async function verifyCodeAtomically(userId, code) {
  if (isPg()) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        'SELECT * FROM verification_codes WHERE user_id = $1 AND used = FALSE ORDER BY created_at DESC LIMIT 1 FOR UPDATE',
        [userId]
      );
      const row = r.rows[0] || null;
      if (!row) {
        await client.query('COMMIT');
        return { status: 'invalid' };
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        await client.query('UPDATE verification_codes SET used = TRUE WHERE id = $1', [row.id]);
        await client.query('COMMIT');
        return { status: 'expired' };
      }
      if (Number(row.attempts || 0) >= 5) {
        await client.query('UPDATE verification_codes SET used = TRUE WHERE id = $1', [row.id]);
        await client.query('COMMIT');
        return { status: 'too_many' };
      }
      const match = await bcrypt.compare(code, row.code_hash);
      if (!match) {
        await client.query('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
        await client.query('COMMIT');
        return { status: 'invalid' };
      }
      await client.query('UPDATE verification_codes SET used = TRUE WHERE id = $1', [row.id]);
      await client.query('UPDATE users SET verified = TRUE WHERE id = $1', [userId]);
      await client.query('COMMIT');
      return { status: 'verified' };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  }

  return withSqliteUserLock(userId, async () => {
    db.exec('BEGIN IMMEDIATE');
    try {
    const row = db.prepare('SELECT * FROM verification_codes WHERE user_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1').get(userId) || null;
    if (!row) {
      db.exec('COMMIT');
      return { status: 'invalid' };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(row.id);
      db.exec('COMMIT');
      return { status: 'expired' };
    }
    if (Number(row.attempts || 0) >= 5) {
      db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(row.id);
      db.exec('COMMIT');
      return { status: 'too_many' };
    }
    const match = await bcrypt.compare(code, row.code_hash);
    if (!match) {
      db.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
      db.exec('COMMIT');
      return { status: 'invalid' };
    }
    db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(row.id);
    db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(userId);
    db.exec('COMMIT');
    return { status: 'verified' };
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw err;
    }
  });
}

// CSRF token endpoint (called by the frontend before any POST here).
router.get('/csrf-token', (req, res) => issueCsrf(req, res));

// POST /api/auth/signup — creates a REAL persistent user row.
router.post('/signup', signupLimiter, requireCsrf, async (req, res) => {
  let createdUserId = null;
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const password = req.body && req.body.password;
    if (!email) return res.status(400).json({ message: 'Enter a valid email address' });
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ message: pwErr });
    // Defense in depth: the signup page already checks the two password
    // fields match, but the frontend can be bypassed, so the backend
    // re-checks whenever the confirmation field is sent.
    if (req.body && req.body.confirmPassword !== undefined && req.body.confirmPassword !== password) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const existing = await findUserByEmail(email);
    // An email is only "taken" by a FULLY VERIFIED, completed account.
    // A started-but-never-verified signup never created a real account, so it
    // must not lock out the address: drop the stale unverified record (and
    // its codes) and restart the signup cleanly below. This is safe because
    // unverified rows hold no session and no user data.
    if (existing && boolOut(existing.verified)) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    if (existing && !boolOut(existing.verified)) {
      try { await deleteUser(existing.id); } catch (_) {}
      // Never log anything sensitive here — just the fact of the cleanup.
      console.log(`[auth] cleared stale unverified signup for ${email}, restarting signup`);
    }

    // bcrypt: adaptive one-way hash with a unique salt per password.
    // Plain text is never stored, so a database leak does not reveal logins.
    const passwordHash = await bcrypt.hash(password, 12);
    const created = nowIso();
    let user;
    if (isPg()) {
      const r = await db.pool.query(
        'INSERT INTO users (email, password_hash, created_at, verified) VALUES ($1,$2,$3,FALSE) RETURNING *',
        [email, passwordHash, created]
      );
      user = r.rows[0];
    } else {
      const r = db.prepare('INSERT INTO users (email, password_hash, created_at, verified) VALUES (?, ?, ?, 0)').run(email, passwordHash, created);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    }
    createdUserId = user.id;

    const expiresAt = await createVerificationCode(user.id, email);
    // Not verified yet → no session cookie. Frontend routes to /verify.
    return res.status(201).json({ user: publicUser(user), verifyExpiresAt: expiresAt });
  } catch (err) {
    // If the code email could not be delivered, roll the signup back so the
    // user can retry (otherwise the next attempt would 409 "already exists").
    if (createdUserId != null && err.isEmailDelivery) {
      try { await deleteUser(createdUserId); } catch (_) {}
    }
    // Log the reason server-side; never the API key or the code itself.
    console.error('[auth] signup error', err.message);
    if (err.isEmailDelivery) {
      return res.status(502).json({ message: 'We could not send your verification email. Please try again or use a different email address.' });
    }
    return res.status(500).json({ message: 'Server error, please try again' });
  }
});

// POST /api/auth/login — checks credentials against the stored hash.
router.post('/login', loginLimiter, requireCsrf, async (req, res) => {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const password = req.body && req.body.password;
    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Enter your email and password' });
    }
    const user = await findUserByEmail(email);
    // Same generic message whether the email or password is wrong: this
    // stops attackers from harvesting which emails have accounts.
    if (!user) return res.status(401).json({ message: 'Incorrect email or password' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Incorrect email or password' });

    if (!boolOut(user.verified)) {
      // Account exists but email not verified yet → send them to /verify.
      return res.status(403).json({ user: publicUser(user), needsVerification: true, message: 'Please verify your email first' });
    }

    // "Remember me" only ever extends the session lifetime (30d vs 7d) via a
    // longer-lived httpOnly cookie + matching token expiry. Any truthy value
    // counts as checked; absent/false keeps current behavior. Nothing secret
    // is stored client-side either way.
    const rememberMe = !!(req.body && req.body.rememberMe);
    const token = signSession({ id: user.id, email: user.email }, rememberMe);
    res.cookie('fh_session', token, cookieOpts(rememberMe));
    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[auth] login error', err.message);
    return res.status(500).json({ message: 'Server error, please try again' });
  }
});

// POST /api/auth/verify — 6-digit code, 10-min expiry, single-use.
router.post('/verify', verifyLimiter, requireCsrf, async (req, res) => {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const code = req.body && req.body.code;
    if (!email) return res.status(400).json({ message: 'Enter a valid email address' });
    const codeErr = validateCode(code);
    if (codeErr) return res.status(400).json({ message: codeErr });

    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json({ message: 'Invalid or expired code' });

    const verification = await verifyCodeAtomically(user.id, String(code).trim());
    if (verification.status === 'expired') {
      return res.status(400).json({ message: 'Code expired, request a new one' });
    }
    if (verification.status === 'too_many') {
      return res.status(429).json({ message: 'Too many wrong attempts, request a new code' });
    }
    if (verification.status !== 'verified') {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const fresh = await findUserById(user.id);
    const token = signSession({ id: fresh.id, email: fresh.email });
    res.cookie('fh_session', token, cookieOpts());
    return res.json({ user: publicUser(fresh) });
  } catch (err) {
    console.error('[auth] verify error', err.message);
    return res.status(500).json({ message: 'Server error, please try again' });
  }
});

// POST /api/auth/resend — new code, 30s server-side cooldown.
router.post('/resend', resendLimiter, requireCsrf, async (req, res) => {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    if (!email) return res.status(400).json({ message: 'Enter a valid email address' });
    const user = await findUserByEmail(email);
    if (!user) return res.json({ message: 'If an account exists, a new code was sent' });
    if (boolOut(user.verified)) return res.json({ message: 'Account already verified, please sign in' });

    let last;
    if (isPg()) {
      const r = await db.pool.query('SELECT * FROM verification_codes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id]);
      last = r.rows[0] || null;
    } else {
      last = db.prepare('SELECT * FROM verification_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(user.id) || null;
    }
    if (last && Date.now() - new Date(last.created_at).getTime() < 30 * 1000) {
      return res.status(429).json({ message: 'Please wait before requesting a new code' });
    }
    const expiresAt = await createVerificationCode(user.id, email);
    return res.json({ message: 'If an account exists, a new code was sent', verifyExpiresAt: expiresAt });
  } catch (err) {
    // Log the reason server-side; never the API key or the code itself.
    console.error('[auth] resend error', err.message);
    if (err.isEmailDelivery) {
      return res.status(502).json({ message: 'We could not send the verification email. Please try again in a moment.' });
    }
    return res.status(500).json({ message: 'Server error, please try again' });
  }
});

// GET /api/auth/me — session check used on every page reload.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Not signed in' });
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/logout — clears the httpOnly session cookie.
router.post('/logout', requireCsrf, (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('fh_session', { path: '/', secure: isProd, sameSite: isProd ? 'None' : 'Lax' });
  return res.json({ message: 'Signed out' });
});

module.exports = router;
