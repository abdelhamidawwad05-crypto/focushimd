const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const sessionRoutes = require('./routes/sessions');
const db = require('./config/db');

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'https://focushimd.site',
  'https://www.focushimd.site',
  'https://focushimd.vercel.app'
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) return cb(null, true);
    cb(null, true);
  }
}));
app.use(express.json());

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/sessions', sessionLimiter, sessionRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Focus Himd API is running', db: db.type || 'sqlite', status: 'ok' });
});

app.get('/api/health', async (req, res) => {
  try {
    let count;
    if (db.type === 'pg') {
      const r = await db.pool.query('SELECT COUNT(*) as c FROM sessions');
      count = parseInt(r.rows[0].c, 10);
    } else {
      count = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
    }
    res.json({ status: 'ok', db: db.type || 'sqlite', sessions: count });
  } catch (e) {
    res.json({ status: 'ok', db: db.type || 'sqlite', sessions: 0 });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Focus Himd server running on port ${PORT} [${db.type || 'sqlite'}]`);
});
