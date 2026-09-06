import { authApi } from '../api/auth.js';

const API = (import.meta.env?.VITE_API_URL || '').trim().replace(/\/$/, '');

const apiUrl = (path) => `${API}${path}`;
const QUEUE_PREFIX = 'fh_session_queue_v1:';

function newClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function queueKey(userId) { return `${QUEUE_PREFIX}${String(userId)}`; }

function readQueue(userId) {
  if (!userId || typeof localStorage === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(queueKey(userId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (e) { return []; }
}

function writeQueue(userId, queue) {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    if (queue.length) localStorage.setItem(queueKey(userId), JSON.stringify(queue));
    else localStorage.removeItem(queueKey(userId));
  } catch (e) {}
}

function localRecord(record) {
  return {
    id: `offline-${record.clientId}`,
    duration: record.duration,
    mood: record.mood,
    note: record.note || '',
    completedAt: record.completedAt,
    pending: true,
  };
}

export function getQueuedSessions(userId) {
  return readQueue(userId).map(localRecord);
}

function queuedForFilter(userId, filter) {
  const queued = getQueuedSessions(userId);
  if (filter === 'week') {
    const from = new Date(); from.setDate(from.getDate() - 7);
    return queued.filter((s) => new Date(s.completedAt) >= from);
  }
  if (filter === 'month') {
    const from = new Date(); from.setMonth(from.getMonth() - 1);
    return queued.filter((s) => new Date(s.completedAt) >= from);
  }
  return queued;
}

const flushLocks = new Map();

async function upload(record) {
  const csrfToken = await authApi.csrfToken();
  const res = await fetch(apiUrl('/api/sessions'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': record.clientId,
    },
    body: JSON.stringify({ duration: record.duration, mood: record.mood, note: record.note || '' })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'backend error');
  return data;
}

async function flushQueueNow(userId) {
  if (!userId) return [];
  const synced = [];
  let queue = readQueue(userId);
  for (const record of queue) {
    try {
      const data = await upload(record);
      queue = queue.filter((item) => item.clientId !== record.clientId);
      writeQueue(userId, queue);
      synced.push({ clientId: record.clientId, data });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fh-session-synced', { detail: { userId, clientId: record.clientId, data } }));
      }
    } catch (e) {
      // Preserve this item and every later item for the next online retry.
      break;
    }
  }
  return synced;
}

export function flushSessionQueue(userId) {
  if (!userId) return Promise.resolve([]);
  const previous = flushLocks.get(String(userId)) || Promise.resolve([]);
  const current = previous.then(() => flushQueueNow(userId), () => flushQueueNow(userId));
  flushLocks.set(String(userId), current);
  return current.finally(() => {
    if (flushLocks.get(String(userId)) === current) flushLocks.delete(String(userId));
  });
}

export async function saveSession({ duration, mood, note, userId, idempotencyKey, completedAt }) {
  if (!userId) throw new Error('You must be signed in to save a session');
  const record = {
    clientId: idempotencyKey || newClientId(),
    duration, mood, note: note || '', userId, completedAt: completedAt || new Date().toISOString()
  };
  const queue = readQueue(userId);
  if (!queue.some((item) => item.clientId === record.clientId)) {
    queue.push(record);
    writeQueue(userId, queue);
  }
  await flushSessionQueue(userId);
  const stillQueued = readQueue(userId).some((item) => item.clientId === record.clientId);
  return { synced: !stillQueued, queued: stillQueued, clientId: record.clientId };
}

export async function getSessions(filter, userId) {
  const queued = queuedForFilter(userId, filter);
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
    return [...data, ...queued];
  } catch (e) {
    return queued;
  }
}

export async function getTodayCount(userId) {
  try {
    const res = await fetch(apiUrl('/api/sessions/today'), { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const queuedToday = getQueuedSessions(userId).filter((s) => new Date(s.completedAt) >= today).length;
    return data.length + queuedToday;
  } catch {
    return getQueuedSessions(userId).filter((s) => new Date(s.completedAt).toDateString() === new Date().toDateString()).length;
  }
}

export async function getStats(userId) {
  try {
    const res = await fetch(apiUrl('/api/sessions/stats'), { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const queued = getQueuedSessions(userId);
    return {
      ...data,
      totalHours: Number(data.totalHours || 0) + queued.reduce((sum, s) => sum + Number(s.duration), 0) / 60,
      totalSessions: Number(data.totalSessions || 0) + queued.length,
    };
  } catch {
    const queued = getQueuedSessions(userId);
    return { streak: 0, totalHours: queued.reduce((sum, s) => sum + Number(s.duration), 0) / 60, totalSessions: queued.length };
  }
}

export async function getWeekly(userId) {
  try {
    const res = await fetch(apiUrl('/api/sessions/weekly'), { credentials: 'include' });
    if (!res.ok) throw new Error();
    const daily = await res.json();
    getQueuedSessions(userId).forEach((s) => {
      const key = new Date(s.completedAt).toISOString().split('T')[0];
      if (daily[key]) {
        daily[key].hours += Number(s.duration) / 60;
        daily[key].moods.push(s.mood);
      }
    });
    return daily;
  } catch {
    const now = new Date();
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const daily = {};
    for (let i=6;i>=0;i--) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      daily[d.toISOString().split('T')[0]] = { hours: 0, moods: [], label: dayNames[d.getDay()] };
    }
    getQueuedSessions(userId).forEach((s) => {
      const key = new Date(s.completedAt).toISOString().split('T')[0];
      if (daily[key]) {
        daily[key].hours += Number(s.duration) / 60;
        daily[key].moods.push(s.mood);
      }
    });
    return daily;
  }
}
