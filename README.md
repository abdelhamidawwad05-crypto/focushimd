# Focus Himd

Self-development tracker — Pomodoro timer + mood journaling.

## Deploy

### Frontend (Vercel)
- Root: `client`
- Build: `npm install && npm run build`
- Output: `dist`
- Env: `VITE_API_URL=https://focushimd.onrender.com`

### Backend (Render)
- Root: `server`
- Build: `npm install`
- Start: `node index.js`
- Env: `DATABASE_URL` (Neon/Supabase Postgres) or leave empty for SQLite

### DNS (Namecheap → Vercel)
- `CNAME www → cname.vercel-dns.com`
- `A @ → 76.76.21.21`
