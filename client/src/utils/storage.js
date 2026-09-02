const LS_KEY = 'focus-himd-sessions';
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const apiUrl = (path) => `${API}${path}`;

const lsGet = () => JSON.parse(localStorage.getItem(LS_KEY) || '[]');
const lsSave = (sessions) => localStorage.setItem(LS_KEY, JSON.stringify(sessions));

export async function saveSession({ duration, mood, note }) {
  try {
    const res = await fetch(apiUrl('/api/sessions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration, mood, note })
    });
    if (!res.ok) throw new Error('backend error');
    const data = await res.json();
    const sessions = lsGet();
    sessions.unshift({ id: data.id, duration: data.duration, mood: data.mood, note: data.note, completedAt: data.completedAt });
    lsSave(sessions);
    return data;
  } catch (e) {
    const entry = { id: Date.now(), duration, mood, note: note || '', completedAt: new Date().toISOString() };
    const sessions = lsGet();
    sessions.unshift(entry);
    lsSave(sessions);
    return entry;
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
    const res = await fetch(url);
    if (!res.ok) throw new Error('backend error');
    const data = await res.json();
    if (filter === 'all' || !filter) lsSave(data);
    return data;
  } catch (e) {
    const all = lsGet();
    const now = new Date();
    if (filter === 'week') {
      const from = new Date(now); from.setDate(from.getDate() - 7);
      return all.filter(s => new Date(s.completedAt) >= from);
    }
    if (filter === 'month') {
      const from = new Date(now); from.setMonth(from.getMonth() - 1);
      return all.filter(s => new Date(s.completedAt) >= from);
    }
    return all;
  }
}

export async function getTodayCount() {
  try {
    const res = await fetch(apiUrl('/api/sessions/today'));
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.length;
  } catch {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    return lsGet().filter(s => {
      const d = new Date(s.completedAt);
      return d >= today && d < tomorrow;
    }).length;
  }
}

export async function getStats() {
  try {
    const res = await fetch(apiUrl('/api/sessions/stats'));
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    const sessions = lsGet();
    const now = new Date(); now.setHours(0,0,0,0);
    let streak = 0;
    const check = new Date(now);
    while (true) {
      const next = new Date(check); next.setDate(next.getDate()+1);
      if (!sessions.some(s => { const d=new Date(s.completedAt); return d>=check && d<next; })) break;
      streak++;
      check.setDate(check.getDate()-1);
      if (streak > 365) break;
    }
    const total = sessions.reduce((a,b)=>a+b.duration,0);
    return { streak, totalHours: parseFloat((total/60).toFixed(1)), totalSessions: sessions.length };
  }
}

export async function getWeekly() {
  try {
    const res = await fetch(apiUrl('/api/sessions/weekly'));
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    const sessions = lsGet();
    const now = new Date();
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const daily = {};
    for (let i=6;i>=0;i--) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      const key = d.toISOString().split('T')[0];
      daily[key] = { hours:0, moods:[], label:dayNames[d.getDay()] };
    }
    sessions.forEach(s => {
      const key = new Date(s.completedAt).toISOString().split('T')[0];
      if (daily[key]) { daily[key].hours += s.duration/60; daily[key].moods.push(s.mood); }
    });
    return daily;
  }
}
