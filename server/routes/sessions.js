const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireCsrf } = require('../middleware/csrf');

const router = express.Router();

const isPg = db.type === 'pg';

// PostgreSQL folds the legacy unquoted completedAt column to completedat.
// Normalize that response shape so all callers use the API's camelCase field.
function sessionOutput(row) {
  if (!row || row.completedat === undefined) return row;
  const { completedat, idempotency_key, ...rest } = row;
  return { ...rest, completedAt: completedat };
}

// Every session endpoint is private. Ownership always comes from the
// verified JWT, never from request body/query input.
router.use(requireAuth);

async function ready() {
  if (db.ready) await db.ready;
}

async function queryAll(text, params) {
  if (isPg) {
    const r = await db.pool.query(text, params);
    return r.rows.map(sessionOutput);
  } else {
     return db.prepare(text).all(...params).map(sessionOutput);
  }
}

router.post('/', requireCsrf, async (req, res) => {
  try {
    await ready();
    const { duration, mood, note } = req.body;
    const idempotencyKey = (req.get('Idempotency-Key') || '').trim();
    if (!duration || !mood || !['good','okay','rough'].includes(mood)) {
      return res.status(400).json({ message: 'duration and valid mood required' });
    }
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ message: 'Idempotency-Key header required' });
    }
    const completedAt = new Date().toISOString();
    let row;
    let created = true;
    if (isPg) {
      const r = await db.pool.query(
        'INSERT INTO sessions (user_id, duration, mood, note, completedat, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *',
        [req.user.id, duration, mood, note || '', completedAt, idempotencyKey]
      );
      if (r.rows[0]) row = sessionOutput(r.rows[0]);
      else {
        created = false;
        const existing = await db.pool.query('SELECT * FROM sessions WHERE user_id = $1 AND idempotency_key = $2', [req.user.id, idempotencyKey]);
        row = sessionOutput(existing.rows[0]);
      }
    } else {
      const result = db.prepare('INSERT OR IGNORE INTO sessions (user_id, duration, mood, note, completedat, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)').run(req.user.id, duration, mood, note || '', completedAt, idempotencyKey);
      row = sessionOutput(db.prepare('SELECT * FROM sessions WHERE user_id = ? AND idempotency_key = ?').get(req.user.id, idempotencyKey));
      created = Number(result.changes || 0) === 1;
    }
    res.status(created ? 201 : 200).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    await ready();
    const { from, to } = req.query;
    if (isPg) {
      let sql = 'SELECT * FROM sessions WHERE user_id = $1';
      const params = [req.user.id];
      if (from) { params.push(new Date(from).toISOString()); sql += ` AND completedat >= $${params.length}`; }
      if (to) { params.push(new Date(to).toISOString()); sql += ` AND completedat <= $${params.length}`; }
      sql += ' ORDER BY completedat DESC';
      const rows = await queryAll(sql, params);
      res.json(rows);
    } else {
      let sql = 'SELECT * FROM sessions WHERE user_id = ?';
      const params = [req.user.id];
      if (from) { sql += ' AND completedat >= ?'; params.push(new Date(from).toISOString()); }
      if (to) { sql += ' AND completedat <= ?'; params.push(new Date(to).toISOString()); }
      sql += ' ORDER BY completedat DESC';
      const rows = db.prepare(sql).all(...params).map(sessionOutput);
       res.json(rows);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/today', async (req, res) => {
  try {
    await ready();
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    let rows;
    if (isPg) {
       rows = await queryAll('SELECT * FROM sessions WHERE user_id = $1 AND completedat >= $2 AND completedat < $3 ORDER BY completedat DESC', [req.user.id, today.toISOString(), tomorrow.toISOString()]);
    } else {
       rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? AND completedat >= ? AND completedat < ? ORDER BY completedat DESC').all(req.user.id, today.toISOString(), tomorrow.toISOString()).map(sessionOutput);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    await ready();
    let rows;
    if (isPg) {
       rows = await queryAll('SELECT * FROM sessions WHERE user_id = $1 ORDER BY completedat DESC', [req.user.id]);
    } else {
       rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY completedat DESC').all(req.user.id).map(sessionOutput);
    }
    const today = new Date(); today.setHours(0,0,0,0);
    let streak = 0;
    const checkDate = new Date(today);
    while (true) {
      const nextDate = new Date(checkDate); nextDate.setDate(nextDate.getDate()+1);
      const has = rows.some(s => {
        const d = new Date(s.completedAt);
        return d >= checkDate && d < nextDate;
      });
      if (!has) break;
      streak++;
      checkDate.setDate(checkDate.getDate()-1);
      if (streak > 365) break;
    }
    const totalMinutes = rows.reduce((sum, s) => sum + Number(s.duration), 0);
    res.json({ streak, totalHours: parseFloat((totalMinutes/60).toFixed(1)), totalSessions: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/weekly', async (req, res) => {
  try {
    await ready();
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate()-7);
    let rows;
    if (isPg) {
       rows = await queryAll('SELECT * FROM sessions WHERE user_id = $1 AND completedat >= $2 ORDER BY completedat ASC', [req.user.id, weekAgo.toISOString()]);
    } else {
       rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? AND completedat >= ? ORDER BY completedat ASC').all(req.user.id, weekAgo.toISOString()).map(sessionOutput);
    }
    const dailyData = {};
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (let i=6;i>=0;i--) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      const key = d.toISOString().split('T')[0];
      dailyData[key] = { hours: 0, moods: [], label: dayNames[d.getDay()] };
    }
    rows.forEach(s => {
      const key = new Date(s.completedAt).toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].hours += Number(s.duration) / 60;
        dailyData[key].moods.push(s.mood);
      }
    });
    res.json(dailyData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
