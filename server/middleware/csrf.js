const crypto = require('crypto');

// ---------------------------------------------------------------------------
// CSRF protection (double-submit cookie pattern), plain-language version:
// the session cookie is sent automatically by the browser, so a malicious
// site could trick your browser into POSTing to our API. To stop that, we
// issue a second random token that JavaScript must read and echo back in the
// X-CSRF-Token header. An attacker's site can't read our cookie (same-origin
// policy), so it can't forge that header. Cookie must match header.
// ---------------------------------------------------------------------------

function csrfCookieOpts() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: false, // JS must be able to read it to echo it back
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    path: '/',
    maxAge: 60 * 60 * 1000 // 1 hour
  };
}

function issueCsrf(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf_token', token, csrfCookieOpts());
  return res.json({ csrfToken: token });
}

function requireCsrf(req, res, next) {
  const cookieToken = req.cookies && req.cookies.csrf_token;
  const headerToken = req.get('X-CSRF-Token');
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ message: 'Missing CSRF token' });
  }
  try {
    const a = Buffer.from(cookieToken, 'utf8');
    const b = Buffer.from(headerToken, 'utf8');
    // timingSafeEqual: compare without leaking info via response timing
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }
  } catch (e) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  next();
}

module.exports = { issueCsrf, requireCsrf };
