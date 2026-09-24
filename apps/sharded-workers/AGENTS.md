# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command               | Purpose                   |
| --------------------- | ------------------------- |
| `npx wrangler dev`    | Local development         |
| `npx wrangler deploy` | Deploy to Cloudflare      |
| `npx wrangler types`  | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/

---

# BatchUp Sharded Worker — Development Guide

## What Is This?

This is one of **7 horizontally-sharded Cloudflare Workers** that handles real-time chat. Each shard runs on a **separate Cloudflare account** with its own D1 database, Durable Objects namespace, and Upstash Redis instance.

The shards are completely independent — no cross-shard communication. The only coordination is:
- **Outbound:** Shards callback to Account 1 every **5** messages to sync metadata + unread deltas (not message content)
- **Inbound:** Account 1 calls the **shard worker HTTP API** (`POST /api/messages`, `POST /api/admin/search`). Account 1's DO internal calls (`init-member`, system messages, etc.) target **Account 1's own DO**, not shards. Shards lazy-init members on first WS connect.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Hono entrypoint — bearer token auth, WebSocket upgrade, CORS, admin search, lazy D1 init |
| `src/do/ChatRoom.ts` | Durable Object — WebSocket, messages, presence, typing, reactions, rate limiting, SQLite (largest file) |
| `src/lib/upstash.ts` | Upstash REST client — **per-shard** connection rate limiting via `INCR` + `EXPIRE` |
| `src/lib/circuit-breaker.ts` | Daily DO request budget tracker (90K/day, warn 70%, degrade 90%) — in-memory |
| `src/lib/crypto.ts` | HMAC-SHA256 bearer verification (stateless) |
| `src/db/schema.ts` | Shard D1: conversations, members, **messages, reactions** |
| `src/routes/health.ts` | Health check — D1 ping, Redis ping, circuit breaker counters |
| `src/env.ts` | Required env validation |
| `wrangler.jsonc` | Per-shard config (placeholders rewritten by CI) |

## Shard Identity

Each shard is identified by:
- `SHARD_ID` — numeric (1-7), set by CI via `sed` replacement in wrangler.jsonc
- `SHARD_NAME` — string (e.g., "shard-1"), set by CI
- `TOTAL_SHARDS` — total shard count (7), wrangler `vars` (declared in types; **not read at runtime** on the shard)

The shard ID is used for logging/budget context. Conversations are routed by Account 1's FNV-1a hash — the signed `shard_id` claim in the bearer is **not currently verified** on the shard (known gap).

## Connection Flow

1. Client gets HMAC-signed bearer token from Account 1 (`GET /api/chat/ws-token?conversationId=X`)
2. Client connects to `wss://{shard-url}/ws/{conversationId}?token={token}`
3. Shard worker (`src/index.ts`) verifies:
   - HMAC signature (stateless, no DB)
   - Token expiry (5-minute TTL) — missing `exp` is treated as non-expiring (known gap)
   - Conversation ID matches token
   - Circuit breaker not in `degrade`
   - **Per-shard** Upstash connection rate limit (`INCR rl:{userId}` + `EXPIRE 65`) — fails open on Redis errors
   - Lazy D1 membership init (creates conversation + member record if first connection)
4. Forward upgrade to `ChatRoom` Durable Object with identity headers (client-supplied identity headers overwritten)
5. DO creates WebSocketPair, accepts with hibernation support

## Durable Object Budget

**CRITICAL:** Cloudflare free tier allows **100,000 DO requests/day** per account.

The circuit breaker tracks this budget:
- `DAILY_DO_BUDGET=90000` (90% of 100K — leaves headroom)
- **Warn** at 70% (63K) — log alert, no user-visible change
- **Degrade** at 90% (81K) — block new WebSocket connections with 503

**What this codebase actually counts** (in-memory on the Worker isolate):
- `init-member` forward (`index.ts`)
- WS upgrade forward (`index.ts`)

It does **not** currently count: `POST /api/messages` → DO, in-DO WebSocket messages, or open/close events. Cloudflare's platform billing counts more broadly than this breaker.

## Redis Usage

**Budget:** 500,000 commands/month per Upstash instance (free tier). Each shard has its **own** instance.

Used for **per-shard** connection rate limiting on WebSocket connect (not shared across shards — a user can hold `limit` connections *per shard*):
- `INCR rl:{userId}` + `EXPIRE rl:{userId} 65` = 2 commands per connection attempt
- `PING` on health check = 1 command

**Do NOT add more Redis commands without checking the budget.**

Available helpers in `src/lib/upstash.ts` (incr/expire/get/set/…) — only `incr`/`expire` are used in production paths; `PING` goes through `upstashCommand` directly.

`INCR` and `EXPIRE` are **not atomic** — a failure between them can leave a key with no TTL (permanent lockout until manual delete) — known issue.

## Shard Callback to Account 1

Every **5** messages sent within a DO (`BATCH_UPDATE_INTERVAL = 5`), it sends a batched HTTP callback to Account 1:
```
POST https://api.batchup.fun/api/internal/shard-callback
Headers: X-Internal-API-Key: {ACCOUNT1_CALLBACK_API_KEY}
Body: {
  "updates": [{ "conversationId", "lastMessageAt", "lastMessagePreview", ... }],
  "unreadUpdates": [{ "conversationId", "userId", "delta" }]
}
```

Retries twice with 2-second delay. Failures are logged but don't block message delivery. `messageCounter` is in-memory only (resets when the DO is evicted).

Account 1's own DO uses interval **100** for direct D1 metadata updates — different code path.

## Deployment

Deployed via `.github/workflows/deploy-shards.yml`. Each shard uses a separate Cloudflare account:
- Shard 1 → Account 2 (`CF_TK_2`, `CF_ACCOUNT_ID_2`)
- ...
- Shard 7 → Account 8 (`CF_TK_8`, `CF_ACCOUNT_ID_8`)

The workflow:
1. Generates matrix `[1, 2, ..., 7]` from `TOTAL_SHARDS` env var
2. For each shard: runs D1 migrations, deploys worker with account-specific credentials (`working-directory: apps/sharded-workers`)
3. `sed` replaces `shard-placeholder-db`, `"placeholder"`, `shard-placeholder-id`, `shard-placeholder-name` in the **single** `wrangler.jsonc` (no `wrangler.shard-N.jsonc` files)
4. `wrangler deploy --name shard-N --minify`

Secrets: `HMAC_SECRET`, `ACCOUNT1_CALLBACK_API_KEY`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`.

Note: `DATABASE_ID_{shard}` is **shard-indexed** while Cloudflare creds are **account-indexed** (shard+1).

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SHARD_ID` | Shard number (1-7), set by CI |
| `SHARD_NAME` | Shard name (e.g., "shard-1"), set by CI |
| `TOTAL_SHARDS` | Total shard count (7) — wrangler vars; not read at runtime on shard |
| `HMAC_SECRET` | Must match Account 1's `SESSION_SECRET` — used to verify bearer tokens |
| `ACCOUNT1_CALLBACK_URL` | Account 1's internal callback endpoint |
| `ACCOUNT1_CALLBACK_API_KEY` | Must match Account 1's `SHARD_CALLBACK_API_KEY` |
| `UPSTASH_REDIS_URL` | This shard's dedicated Upstash Redis REST URL |
| `UPSTASH_REDIS_TOKEN` | This shard's dedicated Upstash Redis auth token (read at runtime; **missing from required list** in `env.ts` — known gap) |
| `DAILY_DO_BUDGET` | DO request budget (90000 = 90% of free tier) |
| `WARN_THRESHOLD` | Circuit breaker warn threshold (0.70 = 70%) |
| `DEGRADE_THRESHOLD` | Circuit breaker degrade threshold (0.90 = 90%) |

Wrong legacy names (do not use): `SHARD_CALLBACK_API_KEY` (that's the *server* var), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DO_REQUEST_BUDGET`.

## Common Pitfalls

- **HMAC_SECRET must match Account 1's SESSION_SECRET exactly**
- **D1 is shard-local** — conversations are not shared across shards
- **DO SQLite is primary for live traffic;** shard D1 also mirrors **messages and reactions** plus conversation/member rows (not metadata-only)
- **Circuit breaker is in-memory on the Worker isolate** — resets on isolate eviction; **never reconstructed from DO storage**; multiple isolates undercount
- **`ws.send()` does not increment *our* counter** (platform billing may differ)
- **Rate limit state is in-memory** in the DO — resets on hibernation; shard DO prunes windows on each check; server DO uses a 60s timer
- **`POST /nuke` DO endpoint** exists (header-only auth) but has no callers — treat as dangerous residue
- **Sequence migration bug:** pre-existing DO DBs that gain the `sequence` column never set `hasSequence=true` (known)
