# Safe Mind Backend

Arabic-language mental health awareness and support platform. This repo is the backend only: REST API. See [CLAUDE.md](CLAUDE.md) for full scope, rules, and phase plan.

Stack: Node 20 (CommonJS) + Express 4, Postgres via Supabase (Auth + Database + Realtime), deployed on Vercel.

## Setup

Prereq: Docker + the Supabase CLI.

```bash
supabase start                 # local Postgres/Auth/Realtime (ports 54322/54321/54323)
npm install
cp .env.example .env           # points at local Supabase by default
npm run migrate                # applies db/migrations/*.sql
npm run seed                   # migrate + seed categories
npm run dev                    # http://localhost:4000
```

- API docs: `http://localhost:4000/api/docs`
- Health check: register a user with `POST /api/v1/auth/register`

To become the first admin, register normally then promote yourself directly in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Demo data

```bash
npm run seed:demo
```

Creates an admin, an approved specialist, and a regular user (all with password `password123`), plus one published article. Safe to re-run.

## Tests

```bash
npm test
```

Runs against the local Supabase Postgres (`DATABASE_URL_TEST`). Migrations run once via Jest's `globalSetup`; each test file truncates tables before every test.

## Deploy

The API deploys to Vercel; data and streaming live in Supabase, so the old PM2/Nginx/MySQL story is gone.

1. Create a Supabase project, then in **Database → Connection → Transaction pooler** copy the connection string. Set it (plus the project URL and keys) in Vercel's environment settings — never commit them:
   - `DATABASE_URL` (pooler, port 6543), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `APP_URL`
2. Run migrations against the cloud database once: `DATABASE_URL=<pooler-url> npm run migrate -- --seed`
3. Deploy: `vercel --prod`. The Express app is mounted via `api/index.js`; `vercel.json` routes `/api/*` to it.

Realtime note: `db/migrations/012_realtime.sql` enables RLS on `messages`/`conversations` and adds them to the `supabase_realtime` publication — that migration must exist in the cloud DB for live messaging to flow.

## Phase status

All 6 phases implemented per CLAUDE.md §7: foundation/auth, emergency, content, mood tracking, appointments/messaging, admin/deploy. Jest tests covering registration, role enforcement, emergency alerts, content search, mood logging, appointment conflicts, messaging access control, and admin actions (audited).