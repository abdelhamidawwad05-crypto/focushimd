// ---------------------------------------------------------------------------
// Input validation + sanitization helpers.
// Plain-language why: the frontend can be bypassed (curl, Postman, scripts),
// so the backend must re-check EVERYTHING. We trim whitespace, force email
// to lowercase, enforce lengths, and reject anything malformed before it
// ever touches the database.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

function cleanString(v, maxLen) {
  if (typeof v !== 'string') return '';
  // strip control chars, trim, cap length (prevents oversized payloads)
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLen);
}

function normalizeEmail(email) {
  const cleaned = cleanString(email, 254).toLowerCase();
  if (!EMAIL_RE.test(cleaned)) return null;
  return cleaned;
}

function validatePassword(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password is too long';
  return null;
}

function validateCode(code) {
  if (typeof code !== 'string' || !CODE_RE.test(code.trim())) {
    return 'Code must be 6 digits';
  }
  return null;
}

module.exports = { normalizeEmail, validatePassword, validateCode, cleanString };
