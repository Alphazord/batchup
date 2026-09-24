# Server (Account 1 Worker)

Hono app on Cloudflare Workers. Control plane for BatchUp: auth, conversation CRUD, payments, admin API, shard routing, internal callbacks. Real-time messaging for sharded conversations is delegated to shard Workers.

## Commands

```bash
cd apps/server
pnpm dev        # wrangler dev → http://localhost:8787
pnpm deploy     # wrangler deploy
pnpm cf-typegen # regenerate worker-configuration.d.ts after binding changes
pnpm generate   # drizzle-kit generate
pnpm studio
npm run migrate
```

## Entry & middleware (`src/index.ts`)

Applied roughly in order:

1. `hono/logger`
2. 1 MB body limit (skipped for WebSocket upgrades)
3. Security headers + CORS (`ALLOWED_ORIGINS`, `credentials: true`)
4. Env validation (first request per isolate — known fail-open-after-first-request bug) + per-request Drizzle connect
5. Per-IP rate limits: auth 10/60s, payments 30/60s, chat+internal+admin 60/60s
5. JSON error handler (generic 500) and 404

Route mounts:

| Mount | Module |
|-------|--------|
| `/` | `routes/health.ts` |
| `/auth` | `routes/auth.ts` |
| `/payments` | `routes/payment.ts` |
| `/api/chat` | `routes/chat.ts` |
| `/api/internal` | `routes/internal.ts` |
| `/api/admin` | `routes/admin.ts` (+ `middleware/admin.ts`) |

## Key files

| Path | Role |
|------|------|
| `src/index.ts` | Hono app, middleware stack |
| `src/routes/auth.ts` | Google OAuth + session lifecycle |
| `src/routes/chat.ts` | Conversations, members, profiles, messages history, ws-token, Account 1 WS upgrade, rate-limit settings |
| `src/routes/payment.ts` | Razorpay create/verify/webhook |
| `src/routes/admin.ts` | Admin GET surface + shard fan-out search |
| `src/routes/internal.ts` | Shard callback receiver |
| `src/routes/health.ts` | D1 + shard pings |
| `src/do/ChatRoom.ts` | Durable Object for non-sharded conversations |
| `src/lib/shard-router.ts` | FNV-1a `assignShard` / `getShardUrl` / `parseShardConfigs` |
| `src/lib/crypto.ts` | `hashSession`, `signBearerToken` |
| `src/middleware/admin.ts` | `X-Admin-API-Key` gate |
| `src/db/tables/*` | Drizzle schema |
| `wrangler.jsonc` | D1, DO, rate-limit bindings |

(Large files are identified by role only — line counts go stale.)

## Session flow

1. `GET /auth/google` — state + PKCE cookies → Google
2. Callback validates state, exchanges code, upserts user/account
3. Generates session token; stores HMAC hash in D1; sets cookie (`.batchup.fun`, httpOnly, Lax, 7d)
4. `GET /auth/me` — verifies session; rotates token when &lt;50% lifetime remains
5. `POST /auth/logout` — Origin check + delete session
6. `POST /auth/refresh` — decrypts Google refresh token only if access token already expired

## WebSocket token flow

1. `GET /api/chat/ws-token?conversationId=X` — session + membership
2. Recompute shard from conversation id (self-heals stale `shard_id`)
3. Sign HMAC bearer (300s): identity, role, tier limits, conversation metadata, `shard_id`, `exp`
4. Return `{ token, shardUrl }`
5. Client connects to shard (or Account 1 `/api/chat/ws/:id` in single-account mode)

History reads use a 30s read-only bearer to `POST {shard}/api/messages`.

## Durable Object (`ChatRoom`)

Used for Account 1-local / non-sharded conversations:

- WebSocket hibernation; membership in DO SQLite
- Messages, reactions, typing, presence, rate limits
- **Buffered** D1 writes for message/reaction rows (500ms or 20 statements, 3 retries)
- Conversation metadata updated in D1 every **100** messages (direct UPDATE — not the HTTP callback; HTTP callback + unread deltas are shard-side, every **5** messages)
- In-memory rate-limit cleanup timer every 60s
- `alarm()` handler exists but is **never armed** in the constructor (known dead safety net)
- Internal endpoints gated by header `x-do-internal: true` (binding-only trust)

Shard DOs are a separate, diverged copy under `apps/sharded-workers`.

## Rate limiting

- HTTP: Cloudflare bindings (see middleware)
- Message: DO in-memory tiers (owner/admin bypass)
- Upstash is **not** used by this app (only shards)

## Environment

Validated by `src/env.ts` (see [environment.md](./environment.md)).

**Required:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `WEB_APP_URL`, `ALLOWED_ORIGINS`  

**Optional:** `RAZORPAY_*`, `SHARD_CONFIGS`, `TOTAL_SHARDS`, `SHARD_CALLBACK_API_KEY`, `ADMIN_API_KEY`

`TOTAL_SHARDS` code default is **8** if unset; wrangler intends 7 (currently under wrong `"env"` key — known issue).

## Internal shard callback

`POST /api/internal/shard-callback` with `X-Internal-API-Key`:

- Caps: updates ≤ 100, unreadUpdates ≤ 1000
- Applies `lastMessageAt` / `lastMessagePreview` and clamped unread deltas
- Accepts `memberCount` in the type but **does not apply it** (Account 1 owns member counts)

## Pitfalls

- D1: `db.batch()` not `db.transaction()`; PRAGMA foreign_keys per request (`src/db/index.ts`)
- DO internal routes require `x-do-internal: true` or return 403
- Bearer TTL is checked at upgrade, not mid-session
- Shard assignment is deterministic; stored ids can self-heal on ws-token issuance
- `btoa` in `signBearerToken` throws on non-Latin1 names (known bug for emoji/CJK in payloads)
