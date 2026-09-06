const jwt = require('jsonwebtoken');
const db = require('../config/db');

// ---------------------------------------------------------------------------
// Auth middleware: reads the session JWT from the httpOnly cookie (never from
// localStorage, so page JavaScript can't steal it via XSS). If valid, the
// safe user identity is attached to req.user. Sensitive fields (password
// hash) are NEVER loaded here and NEVER sent to the frontend.
// ---------------------------------------------------------------------------

// Session lifetimes: default keeps the current 7-day behavior; a login with
// "Remember me" checked gets 30 days. Both are persistent httpOnly Secure
// cookies (survive browser restarts) — credentials never touch localStorage.
const SESSION_DAYS = 7;
const REMEMBER_DAYS = 30;

function cookieOpts(rememberMe) {
  const days = rememberMe ? REMEMBER_DAYS : SESSION_DAYS;
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,          // JS in the page cannot read it (XSS protection)
    secure: isProd,          // HTTPS-only in production (no plain-HTTP leak)
    sameSite: isProd ? 'None' : 'Lax', // None+Secure needed: frontend
    // (focushimd.site) and API (focushimd.onrender.com) are cross-site
    path: '/',
    maxAge: days * 24 * 60 * 60 * 1000
  };
}

function signSession(user, rememberMe) {
  return jwt.sign(
    { id: user.id, email: user.email, sessionVersion: Number(user.session_version ?? user.sessionVersion ?? 0) },
    jwtSecret(),
    // Token lifetime always matches the cookie lifetime so neither outlives
    // the other (an outlived token would either strand or over-extend login).
    { expiresIn: rememberMe ? '30d' : '7d' }
  );
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret?.trim()) {
    throw new Error('JWT_SECRET is required in production');
  }
  // Development-only convenience; index.js refuses this path in production.
  return secret || 'dev-only-change-me';
}

async function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.fh_session;
  if (!token) return res.status(401).json({ message: 'Not signed in' });
  try {
    req.user = jwt.verify(token, jwtSecret());
    let currentVersion = 0;
    if (db.type === 'pg') {
      const result = await db.pool.query('SELECT session_version FROM users WHERE id = $1', [req.user.id]);
      if (!result.rows[0]) return res.status(401).json({ message: 'Not signed in' });
      currentVersion = Number(result.rows[0].session_version || 0);
    } else {
      const row = db.prepare('SELECT session_version FROM users WHERE id = ?').get(req.user.id);
      if (!row) return res.status(401).json({ message: 'Not signed in' });
      currentVersion = Number(row.session_version || 0);
    }
    if (Number(req.user.sessionVersion || 0) !== currentVersion) {
      return res.status(401).json({ message: 'Session expired, please sign in again' });
    }
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Session expired, please sign in again' });
  }
}

module.exports = { requireAuth, signSession, cookieOpts };
