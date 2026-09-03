const jwt = require('jsonwebtoken');

// ---------------------------------------------------------------------------
// Auth middleware: reads the session JWT from the httpOnly cookie (never from
// localStorage, so page JavaScript can't steal it via XSS). If valid, the
// safe user identity is attached to req.user. Sensitive fields (password
// hash) are NEVER loaded here and NEVER sent to the frontend.
// ---------------------------------------------------------------------------

function cookieOpts() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,          // JS in the page cannot read it (XSS protection)
    secure: isProd,          // HTTPS-only in production (no plain-HTTP leak)
    sameSite: isProd ? 'None' : 'Lax', // None+Secure needed: frontend
    // (focushimd.site) and API (focushimd.onrender.com) are cross-site
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
}

function signSession(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'dev-only-change-me',
    { expiresIn: '7d' }
  );
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.fh_session;
  if (!token) return res.status(401).json({ message: 'Not signed in' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-change-me');
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Session expired, please sign in again' });
  }
}

module.exports = { requireAuth, signSession, cookieOpts };
