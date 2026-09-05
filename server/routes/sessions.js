const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const isPg = db.type === 'pg';

// Every session endpoint is private. Ownership always comes from the
// verified JWT, never from request body/query input.
router.use(requireAuth);

async function ready() {
  if (db.ready) await db.ready;
}

// helper
async function queryAll(text, params) {
  if (isPg) {
    const r = await db.pool.query(text, params);
    return r.rows;
  } else {
    return db.prepare(text).all(...params);
  }
}
async function queryGet(text, params) {
  if (isPg) {
    const r = await db.pool.query(text, params);
    return r.rows[0];
  } else {
    return db.prepare(text).get(...params);
  }
}
async function queryRun(text, params) {
  if (isPg) {
    const r = await db.pool.query(text, params);
    return r.rows[0];
  } else {
    const r = db.prepare(text).run(...params);
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(r.lastInsertRowid);
  }
}

router.post('/', async (req, res) => {
  try {
    await ready();
    const { duration, mood, note } = req.body;
    if (!duration || !mood || !['good','okay','rough'].includes(mood)) {
      return res.status(400).json({ message: 'duration and valid mood required' });
    }
    const completedAt = new Date().toISOString();
    let row;
    if (isPg) {
      const r = await db.pool.query(
        'INSERT INTO sessions (user_id, duration, mood, note, completedAt) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [req.user.id, duration, mood, note || '', completedAt]
      );
      row = r.rows[0];
    } else {
      const stmt = db.prepare('INSERT INTO sessions (user_id, duration, mood, note, completedAt) VALUES (?, ?, ?, ?, ?)');
      const result = stmt.run(req.user.id, duration, mood, note || '', completedAt);
      row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
    }
    res.status(201).json(row);
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
      if (from) { params.push(new Date(from).toISOString()); sql += ` AND completedAt >= $${params.length}`; }
      if (to) { params.push(new Date(to).toISOString()); sql += ` AND completedAt <= $${params.length}`; }
      sql += ' ORDER BY completedAt DESC';
      const rows = await queryAll(sql, params);
      res.json(rows);
    } else {
      let sql = 'SELECT * FROM sessions WHERE user_id = ?';
      const params = [req.user.id];
      if (from) { sql += ' AND completedAt >= ?'; params.push(new Date(from).toISOString()); }
      if (to) { sql += ' AND completedAt <= ?'; params.push(new Date(to).toISOString()); }
      sql += ' ORDER BY completedAt DESC';
      const rows = db.prepare(sql).all(...params);
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
       rows = await queryAll('SELECT * FROM sessions WHERE user_id = $1 AND completedAt >= $2 AND completedAt < $3 ORDER BY completedAt DESC', [req.user.id, today.toISOString(), tomorrow.toISOString()]);
    } else {
       rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? AND completedAt >= ? AND completedAt < ? ORDER BY completedAt DESC').all(req.user.id, today.toISOString(), tomorrow.toISOString());
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
       rows = await queryAll('SELECT * FROM sessions WHERE user_id = $1 ORDER BY completedAt DESC', [req.user.id]);
    } else {
       rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY completedAt DESC').all(req.user.id);
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
       rows = await queryAll('SELECT * FROM sessions WHERE user_id = $1 AND completedAt >= $2 ORDER BY completedAt ASC', [req.user.id, weekAgo.toISOString()]);
    } else {
       rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? AND completedAt >= ? ORDER BY completedAt ASC').all(req.user.id, weekAgo.toISOString());
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
