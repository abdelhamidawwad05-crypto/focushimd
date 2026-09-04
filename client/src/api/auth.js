// ---------------------------------------------------------------------------
// Auth API client — same VITE_API_URL convention as utils/storage.js.
// Sessions live in an httpOnly cookie, so every request uses
// credentials:'include' (cookies are sent) + the X-CSRF-Token header
// (double-submit CSRF). No JWT is ever stored in localStorage.
// ---------------------------------------------------------------------------

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API}${path}`;

let csrfToken = null;

async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const res = await fetch(apiUrl('/api/auth/csrf-token'), { credentials: 'include' });
  if (!res.ok) throw new Error('Could not start a secure session');
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function post(path, body) {
  const token = await ensureCsrf();
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function get(path) {
  const res = await fetch(apiUrl(path), { credentials: 'include' });
  if (res.status === 401) return { user: null };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const authApi = {
  signup: (email, password, confirmPassword) => post('/api/auth/signup', { email, password, confirmPassword }),
  login: (email, password) => post('/api/auth/login', { email, password }),
  verify: (email, code) => post('/api/auth/verify', { email, code }),
  resend: (email) => post('/api/auth/resend', { email }),
  logout: () => post('/api/auth/logout', {}),
  me: () => get('/api/auth/me'),
};
