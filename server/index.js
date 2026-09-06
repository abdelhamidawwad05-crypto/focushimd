const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Never boot production with a forgeable default signing key. Render must
// provide JWT_SECRET as a secret environment variable.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET?.trim()) {
  throw new Error('FATAL: JWT_SECRET must be set in production; refusing to start');
}

const sessionRoutes = require('./routes/sessions');
const authRoutes = require('./routes/auth');
const db = require('./config/db');

const app = express();
// Behind Render's proxy; needed so Secure cookies + client IPs work right.
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:3000',
  'https://focushimd.site',
  'https://www.focushimd.site',
  'https://focushimd.vercel.app'
];

function isAllowedOrigin(origin) {
  if (!origin) return true; // curl / health checks have no Origin
  if (allowedOrigins.includes(origin)) return true;
  return false;
}

// CORS with credentials: the browser will only send our httpOnly session
// cookie when credentials:true AND the origin is explicitly allow-listed
// (a wildcard '*' would silently drop cookies).
app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '32kb' }));

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/sessions', sessionLimiter, sessionRoutes);
app.use('/api/auth', authRoutes);

// Error handler: ensure all API errors return JSON, never HTML
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.error('[api error]', err?.message || err);
    const status = err?.status || err?.statusCode || 500;
    return res.status(status).json({ message: err?.message || 'Server error' });
  }
  next(err);
});

app.get('/', (req, res) => {
  res.json({ message: 'Focus Himd API is running', db: db.type || 'sqlite', status: 'ok' });
});

app.get('/api/health', async (req, res) => {
  try {
    let sessions = 0;
    let users = 0;
    if (db.type === 'pg') {
      sessions = parseInt((await db.pool.query('SELECT COUNT(*) as c FROM sessions')).rows[0].c, 10);
      try { users = parseInt((await db.pool.query('SELECT COUNT(*) as c FROM users')).rows[0].c, 10); } catch (e) { users = 0; }
    } else {
      sessions = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
      try { users = db.prepare('SELECT COUNT(*) as c FROM users').get().c; } catch (e) { users = 0; }
    }
    res.json({ status: 'ok', db: db.type || 'sqlite', sessions, users });
  } catch (e) {
    res.json({ status: 'ok', db: db.type || 'sqlite', sessions: 0, users: 0 });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Focus Himd server running on port ${PORT} [${db.type || 'sqlite'}]`);
});
