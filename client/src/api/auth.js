// ---------------------------------------------------------------------------
// Auth API client — same VITE_API_URL convention as utils/storage.js.
// Sessions live in an httpOnly cookie, so every request uses
// credentials:'include' (cookies are sent) + the X-CSRF-Token header
// (double-submit CSRF). No JWT is ever stored in localStorage.
// ---------------------------------------------------------------------------

const API = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const apiUrl = (path) => `${API}${path}`;

function networkError(e) {
  if (e instanceof TypeError && /Failed to fetch|NetworkError|Load failed|AbortError/i.test(e.message)) {
    return new Error('Cannot reach the server. Please check your connection or try again later.');
  }
  return e;
}

let csrfToken = null;

async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  let res;
  try {
    res = await fetch(apiUrl('/api/auth/csrf-token'), { credentials: 'include' });
  } catch (e) { throw networkError(e); }
  if (!res.ok) throw new Error('Could not start a secure session');
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function post(path, body) {
  const token = await ensureCsrf();
  let res;
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify(body || {})
    });
  } catch (e) { throw networkError(e); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function get(path) {
  let res;
  try {
    res = await fetch(apiUrl(path), { credentials: 'include' });
  } catch (e) { throw networkError(e); }
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
