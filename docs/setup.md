# Local Development Setup

## Prerequisites

- Node.js **20+** (repo pins 24 via `.node-version`; CI uses 22–24)
- pnpm
- Google Cloud project (for OAuth)
- Cloudflare account — only required for remote deploys/migrations (local D1 runs as a SQLite file under `.wrangler/state`)
- Upstash account — only if running a local shard worker with rate limiting
- Razorpay account — only if enabling payments (optional; catalog is currently empty)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start apps in separate terminals (there is no root dev script)
pnpm --filter @repo/server dev
pnpm --filter @repo/web dev
```

Expected local URLs:

- Frontend: http://localhost:3000 (`next dev` default)
- Server: http://localhost:8787 (`wrangler dev` default)
- Shard workers: each `wrangler dev` also defaults to **8787** — pass `--port` explicitly to run shards beside the server (e.g. `wrangler dev --port 8788`)

## Manual Setup

### 1. Environment variables

Copy the example files (there is no root `.env.example`):

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp apps/sharded-workers/.dev.vars.example apps/sharded-workers/.dev.vars
cp apps/web/.env.local.example apps/web/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local
```

**Server required** (validation fails the first request per isolate if missing):

- `SESSION_SECRET` — random string, min 32 chars
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Cloud Console
- `WEB_APP_URL` — e.g. `http://localhost:3000`
- `ALLOWED_ORIGINS` — comma-separated, e.g. `http://localhost:3000`

**Server optional** (features disabled or fallbacks if unset):

- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `SHARD_CONFIGS`, `TOTAL_SHARDS`, `SHARD_CALLBACK_API_KEY`, `ADMIN_API_KEY`

Full reference: [environment.md](./environment.md).

### 2. Database

```bash
cd apps/server

# Generate a Drizzle migration (writes to migrations/)
pnpm generate

# Apply migrations to local D1 (wrangler local state)
# Prefer wrangler's migrator for local/remote:
npx wrangler d1 migrations apply realtime-chat-app --local

# Or use the repo helper script (note: reads ./drizzle — known path mismatch; prefer wrangler command above)
npm run migrate
```

The production database `realtime-chat-app` already exists; re-running `wrangler d1 create` against it will error.

### 3. Start server

```bash
cd apps/server
pnpm dev   # wrangler dev → http://localhost:8787
```

### 4. Start frontend

```bash
cd apps/web
pnpm dev   # next dev → http://localhost:3000
```

## Development commands

Root (`package.json`):

| Command | Description |
|---------|-------------|
| `pnpm test` | Run package unit tests (vitest) |
| `pnpm lint` | Lint the workspace |
| `pnpm typecheck` | `nx run-many -t typecheck` (does **not** include `@repo/web`) |
| `pnpm format` | Prettier write |

Per app: `pnpm --filter @repo/<name> dev|build|deploy`.

There is **no** root `dev`, `build`, `db:*`, or `deploy:shards` script.

## Type checking

```bash
# Shared types (if @repo/types changed)
npx tsc --project packages/types/tsconfig.json

npx tsc --noEmit --project apps/web/tsconfig.json
npx tsc --noEmit --project apps/server/tsconfig.json
npx tsc --noEmit --project apps/admin/tsconfig.json
npx tsc --noEmit --project apps/sharded-workers/tsconfig.json
```

## Database commands

From `apps/server` (not root):

```bash
pnpm generate   # drizzle-kit generate → migrations/
pnpm studio     # drizzle-kit studio
npm run migrate # scripts/execute-d1.mjs
```

From `apps/sharded-workers`:

```bash
pnpm generate
pnpm amend
```

Both Drizzle configs use `d1-http` and need `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_ID`, and `CLOUDFLARE_API_TOKEN` in the environment.

## Troubleshooting

### D1 connection issues

Local D1 is a SQLite file under wrangler state. Reset:

```bash
cd apps/server
rm -rf .wrangler/state
npx wrangler d1 migrations apply realtime-chat-app --local
```

### WebSocket connection issues

- Ensure a shard worker (or the server, for non-sharded mode) is reachable on the host/port the client uses.
- `SHARD_CONFIGS` is set in `apps/server/.dev.vars` for local multi-shard dev — not in a root `.env` file.
- All local `wrangler dev` processes default to port 8787; pass `--port` to avoid collisions.

### Type errors after pull

```bash
npx tsc --project packages/types/tsconfig.json
pnpm typecheck
```
