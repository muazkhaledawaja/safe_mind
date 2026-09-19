# Safe Mind Backend

Arabic-language mental health awareness and support platform. This repo is the backend only: REST API + MySQL. See [CLAUDE.md](CLAUDE.md) for full scope, rules, and phase plan.

## Setup

```bash
docker compose up -d          # starts MySQL 8, creates safe_mind + safe_mind_test
npm install
cp .env.example .env          # fill in JWT_SECRET at minimum; SMTP can stay dummy locally
npm run migrate               # applies db/migrations/*.sql
npm run seed                  # migrate + seed categories
npm run dev                   # http://localhost:4000
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

Runs against `safe_mind_test` (same MySQL container). Migrations run once via Jest's `globalSetup`; each test file truncates tables before every test.

## Deploy

Deploy configs live in `deploy/`:

- `deploy/nginx/safe-mind.conf` — reverse proxy to the Node process on port 4000. Symlink into `sites-enabled`, then run `certbot --nginx -d api.safemind.app` for SSL.
- `deploy/ecosystem.config.js` — PM2 process file. `pm2 start deploy/ecosystem.config.js --env production`, then `pm2 save` and `pm2 startup` so it survives a reboot.
- `deploy/backup.sh` — nightly `mysqldump`, gzipped, 14-day retention. Add to cron: `0 3 * * * /path/to/safe_mind/deploy/backup.sh >> /var/log/safe-mind-backup.log 2>&1`

```bash
git clone <repo> && cd safe_mind
npm install --omit=dev
cp .env.example .env   # fill in real production values
npm run migrate
npm run seed
pm2 start deploy/ecosystem.config.js --env production
```

## Phase status

All 6 phases implemented per CLAUDE.md §7: foundation/auth, emergency, content, mood tracking, appointments/messaging, admin/deploy. 61 Jest tests covering registration, role enforcement, emergency alerts, content search, mood logging, appointment conflicts, messaging access control, and admin actions (audited).
