import { authApi } from '../api/auth';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const apiUrl = (path) => `${API}${path}`;

export async function saveSession({ duration, mood, note }) {
  try {
    const csrfToken = await authApi.csrfToken();
    const res = await fetch(apiUrl('/api/sessions'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ duration, mood, note })
    });
    if (!res.ok) throw new Error('backend error');
    const data = await res.json();
    return data;
  } catch (e) {
    // Never fall back to a shared localStorage list: a failed authenticated
    // request must not make one user's sessions appear under another user.
    throw new Error('Could not save this session. Please try again.');
  }
}

export async function getSessions(filter) {
  try {
    let url = apiUrl('/api/sessions');
    if (filter === 'week') {
      const from = new Date(); from.setDate(from.getDate() - 7);
      url += `?from=${from.toISOString()}`;
    } else if (filter === 'month') {
      const from = new Date(); from.setMonth(from.getMonth() - 1);
      url += `?from=${from.toISOString()}`;
    }
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('backend error');
    const data = await res.json();
    return data;
  } catch (e) {
    return [];
  }
}

export async function getTodayCount() {
  try {
    const res = await fetch(apiUrl('/api/sessions/today'), { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.length;
  } catch {
    return 0;
  }
}

export async function getStats() {
  try {
    const res = await fetch(apiUrl('/api/sessions/stats'), { credentials: 'include' });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { streak: 0, totalHours: 0, totalSessions: 0 };
  }
}

export async function getWeekly() {
  try {
    const res = await fetch(apiUrl('/api/sessions/weekly'), { credentials: 'include' });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    const now = new Date();
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const daily = {};
    for (let i=6;i>=0;i--) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      daily[d.toISOString().split('T')[0]] = { hours: 0, moods: [], label: dayNames[d.getDay()] };
    }
    return daily;
  }
}
