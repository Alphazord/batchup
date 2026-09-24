# Deployment

## Prerequisites

- Node.js **20+** (workflows use 22 or 24 — prefer aligning on 24; known inconsistency)
- pnpm
- 8 Cloudflare accounts: 1 primary (Account 1) + Accounts 2–8 for shards 1–7
- Google Cloud OAuth client
- Upstash Redis (one database per shard)
- Razorpay account (optional — payments currently non-functional with empty catalog)
- GitHub repository secrets (see below)

Production is configured via **GitHub secrets + Cloudflare Workers dashboard**, not a root `.env` file.

## Deploy targets

| App | Target | Workflow |
|-----|--------|----------|
| `apps/server` | Cloudflare Workers | `.github/workflows/deploy.server.yml` |
| `apps/web` | Cloudflare Workers (OpenNext) | `.github/workflows/deploy.web.yml` |
| `apps/admin` | Cloudflare Workers (OpenNext) | `.github/workflows/deploy.admin.yml` |
| `apps/sharded-workers` | 7 Workers on accounts 2–8 | `.github/workflows/deploy-shards.yml` |

There is no Vercel/Pages deploy and no `pnpm deploy:shards` script. Shards use a **single** `wrangler.jsonc` with placeholders (`shard-placeholder-db`, `"placeholder"`, `shard-placeholder-id`, `shard-placeholder-name`) that CI rewrites with `sed` per shard — there are no `wrangler.shard-N.jsonc` files.

## CI workflow (`.github/workflows/ci.yml`)

On push/PR:

1. `pnpm install --frozen-lockfile` (Node 24)
2. `pnpm nx affected -t build typecheck`
3. `pnpm vitest run`
4. `pnpm nx run-many -t lint`
5. `pnpm audit --audit-level=high`

## 1. Deploy server

Triggered by changes under `apps/server/**` (and some packages — see known gap below).

```bash
cd apps/server
npx wrangler d1 migrations apply realtime-chat-app --remote   # run by CI
npx wrangler deploy --minify
```

Configure Account 1 secrets in the Workers dashboard (see [environment.md](./environment.md)).

**Known gap:** `deploy.server.yml` path filters omit `packages/auth`, `packages/http`, `packages/payments`, `packages/products` — changes there will not auto-deploy the server.

## 2. Deploy shards

Triggered by `apps/sharded-workers/**` or manually via `workflow_dispatch`.

Workflow for each shard `N` in `1..7`:

1. Account index = `N + 1` (shard 1 → Account 2 … shard 7 → Account 8)
2. `sed` replaces placeholders in `apps/sharded-workers/wrangler.jsonc`
3. Applies D1 migrations to `shard-N-db`
4. Pushes secrets: `HMAC_SECRET`, `ACCOUNT1_CALLBACK_API_KEY`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`
5. `npx wrangler deploy --name shard-N --minify`

GitHub secrets (naming asymmetry — keep straight):

- `CF_TK_{N+1}`, `CF_ACCOUNT_ID_{N+1}` — account-indexed Cloudflare credentials
- `DATABASE_ID_{N}` — **shard-indexed** D1 database id
- `RD_API_{N}`, `RD_API_{N}_TOKEN` — per-shard Upstash
- `HMAC_SECRET`, `SHARD_CALLBACK_API_KEY` — shared with Account 1

Provisioning D1 databases: `scripts/provision-shards.sh` (known issue: defaults to 9 accounts and account/shard indexing differs from CI — reconcile before use).

## 3. Deploy web

```bash
cd apps/web
pnpm deploy   # opennextjs-cloudflare build && opennextjs-cloudflare deploy → Cloudflare Workers
```

CI sets `NEXT_PUBLIC_SERVER_URL` (and an unused `NEXT_PUBLIC_SITE_URL`).

**Known gap:** path filters omit `packages/products` (declared in web `package.json`, currently unused in code).

## 4. Deploy admin

```bash
cd apps/admin
pnpm deploy
```

Requires Account 1 `ADMIN_API_KEY` and `NEXT_PUBLIC_SERVER_URL`. Workflow name still says “Cloudflare Pages” — it actually deploys to Workers (known naming issue).

## 5. Database migrations

CI (server):

```bash
npx wrangler d1 migrations apply realtime-chat-app --remote
```

CI (each shard): same against `shard-N-db` with `working-directory: apps/sharded-workers`.

Local helper: `apps/server` → `npm run migrate` (script reads `./drizzle` while migrations live in `./migrations` — known path bug; prefer wrangler).

## Health checks

```bash
curl https://api.batchup.fun/health
```

Returns overall status, D1 latency, and per-shard ping results (latency, D1, Redis, circuit-breaker counters). **No connection counts** are included.

Shard health: `https://shard-N.../health` (unauthenticated; exposes shard id/name and telemetry).

## Monitoring

- Cloudflare Workers Observability (`observability.enabled: true` on all wrangler configs)
- Workers / D1 / DO dashboards per account
- `upload_source_maps: false` — stack traces may be less readable (known)

## Rollback

Re-deploy the previous git commit via the corresponding workflow (wrangler deploy replaces the Worker version).

## Scaling shards

> **WARNING — changing `TOTAL_SHARDS` is dangerous.**
>
> Shard assignment is `FNV-1a(conversationId) % TOTAL_SHARDS + 1`. Changing `TOTAL_SHARDS` changes the mapping for **existing** conversation IDs. The ws-token flow **recomputes** and may rewrite `conversations.shard_id` on each issuance, while message history remains on the old shard's DO/D1. This can split-brain a conversation.
>
> There is **no data-migration tool** in this repo. Do not add or remove shards without a migration plan (export/replay DO messages and metadata yourself).

To add a shard (only with a migration plan):

1. Provision Account N+1 + D1 + Upstash
2. Add GitHub secrets `CF_TK_*`, `CF_ACCOUNT_ID_*`, `DATABASE_ID_*`, `RD_API_*`
3. Deploy via `deploy-shards.yml`
4. Update Account 1 `SHARD_CONFIGS` and `TOTAL_SHARDS` (correctly, under `vars`/dashboard)
5. Migrate existing conversation data before traffic uses the new hash space

Removing shards is equally unsafe (also changes `hash % N`).

## Nuke workflow

`.github/workflows/nuke.yml` truncates Account 1 and shard D1 tables (requires typing `NUKE`).

**Known issues:** wrangler steps run from repo root without `working-directory` (may fail to find config); node-version 22 vs 24 elsewhere; summary text lists only 4 of 8 Account-1 tables.
