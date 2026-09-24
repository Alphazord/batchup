# Environment Variables

Variable names below match code (`apps/*/src/env.ts`, `process.env` / `c.env` reads).  
Examples live in each app's `.dev.vars.example` / `.env.local.example`.

---

## Server (Account 1 Worker)

Validated in `apps/server/src/env.ts`. Missing **required** vars cause the request middleware to return `500 Server misconfigured` (first request per isolate).

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SESSION_SECRET` | HMAC-SHA256 secret for session hashing + bearer signing (min 32 chars) | `your-secret-key-here-min-32-chars` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |
| `WEB_APP_URL` | Frontend base URL for OAuth redirects | `http://localhost:3000` or `https://batchup.fun` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `http://localhost:3000` |

> `ALLOWED_ORIGINS` is **required** by validation. The code also has a fallback default of `http://localhost:3000` in `src/lib/origins.ts`, but that path is not reached if validation fails first.

### Optional

| Variable | Description | Default / notes |
|----------|-------------|-----------------|
| `RAZORPAY_KEY_ID` | Razorpay publishable key ID | unset → payments disabled |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | unset → payments disabled |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret | unset → webhook returns 500 (fail-closed) |
| `SHARD_CONFIGS` | JSON array of shard configurations | `[]` (single-account mode) |
| `TOTAL_SHARDS` | Number of shards | **Code fallback is `8`** if unset (`chat.ts` / `admin.ts`); wrangler intends `7` — see known issue below |
| `SHARD_CALLBACK_API_KEY` | API key shards must send to Account 1 callbacks | must equal each shard's `ACCOUNT1_CALLBACK_API_KEY` |
| `ADMIN_API_KEY` | Admin dashboard API key (`X-Admin-API-Key`) | unset → admin routes return 503 (fail-closed) |

### Known config issue (TOTAL_SHARDS)

`apps/server/wrangler.jsonc` currently places `TOTAL_SHARDS` and `SHARD_CALLBACK_API_KEY` under the top-level `"env"` key (named-environment map) instead of `"vars"`. Wrangler may **not** inject them as plain variables (generated `worker-configuration.d.ts` omits them). Until fixed, treat the code default **8** as the real fallback and set the vars correctly in the dashboard/CI. See [../fixes/FINDINGS.md](../fixes/FINDINGS.md) BUG 6.

### Shard config format

`SHARD_CONFIGS` is a JSON array. Only `id` (number) and `url` (string) are required by the parser; `name` and `cfAccountId` are informational. `kvNamespace` is unused/legacy — omit it.

```json
[
  {
    "id": 1,
    "name": "shard-1",
    "url": "https://shard-1.batchup.fun",
    "cfAccountId": "account-id-2"
  }
]
```

---

## Shard Workers

Required list: `apps/sharded-workers/src/env.ts`.

### Required (secrets via `wrangler secret put` / `.dev.vars`)

| Variable | Description | Example |
|----------|-------------|---------|
| `SHARD_ID` | This shard's ID (1–7); also set as wrangler `vars` placeholder replaced by CI | `1` |
| `HMAC_SECRET` | Bearer verification secret — **must equal** Account 1 `SESSION_SECRET` | `...` |
| `ACCOUNT1_CALLBACK_URL` | Account 1 callback endpoint | `https://api.batchup.fun/api/internal/shard-callback` |
| `ACCOUNT1_CALLBACK_API_KEY` | Callback auth key — **must equal** Account 1 `SHARD_CALLBACK_API_KEY` | `...` |
| `UPSTASH_REDIS_URL` | This shard's dedicated Upstash REST URL | `https://...` |
| `UPSTASH_REDIS_TOKEN` | Upstash auth token (read at runtime; add to required list in code as a hardening step) | `...` |

### Optional (wrangler `vars` / defaults)

| Variable | Description | Default |
|----------|-------------|---------|
| `SHARD_NAME` | Display name (CI sed placeholder) | `shard-placeholder-name` |
| `TOTAL_SHARDS` | Declared in types; not read at runtime on the shard | `7` |
| `DAILY_DO_BUDGET` | Circuit-breaker daily DO budget | `90000` |
| `WARN_THRESHOLD` | Warn ratio | `0.70` |
| `DEGRADE_THRESHOLD` | Degrade ratio (blocks new WS) | `0.90` |

**Do not** use these wrong names (legacy doc errors): `SHARD_CALLBACK_API_KEY` (that is the *server* var), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DO_REQUEST_BUDGET`.

---

## Frontend (Next.js web + admin)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SERVER_URL` | Backend API base URL | `https://api.batchup.fun` (web runtime default) / `http://localhost:8787` (CSP/config default) |

Notes:

- This is the **only** `NEXT_PUBLIC_*` API variable the code reads.
- There is **no** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, or `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in code — do not set them expecting effect.
- WebSocket targets are **not** configured via env: the client uses `shardUrl` from `GET /api/chat/ws-token`.
- `next.config.ts` and `src/config/env.ts` use **different defaults** for an unset `NEXT_PUBLIC_SERVER_URL` (localhost vs production). Always set the variable in real builds.

Example files:

- `apps/web/.env.local.example` — includes unused `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_SITE_URL` entries (known residue; code ignores them)
- `apps/admin/.env.local.example`

---

## Local development layout

Do **not** rely on a single root `.env` for app runtime.

| App | File |
|-----|------|
| Server | `apps/server/.dev.vars` |
| Shard | `apps/sharded-workers/.dev.vars` |
| Web | `apps/web/.env.local` |
| Admin | `apps/admin/.env.local` |

Root `.env` (if present) is only consumed by `scripts/provision-shards.sh` for provisioning.

---

## Production configuration

### Account 1 (Workers dashboard / wrangler secrets)

- `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WEB_APP_URL`, `ALLOWED_ORIGINS`
- `SHARD_CONFIGS`, `SHARD_CALLBACK_API_KEY`, `ADMIN_API_KEY`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `TOTAL_SHARDS` — ensure it is a real var (`vars` key or dashboard), not nested under `"env"`

### Shard workers

Secrets set by `.github/workflows/deploy-shards.yml`:

- `HMAC_SECRET`
- `ACCOUNT1_CALLBACK_API_KEY` (from GitHub secret `SHARD_CALLBACK_API_KEY`)
- `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` (from `RD_API_{n}` / `RD_API_{n}_TOKEN`)

Wrangler `vars` (CI `sed`-rewritten placeholders in `wrangler.jsonc`):

- `SHARD_ID`, `SHARD_NAME`, `TOTAL_SHARDS`, `ACCOUNT1_CALLBACK_URL`, `DAILY_DO_BUDGET`, `WARN_THRESHOLD`, `DEGRADE_THRESHOLD`

Dashboard edits to `SHARD_ID`/`SHARD_NAME` are **overwritten on each deploy** by CI sed.
