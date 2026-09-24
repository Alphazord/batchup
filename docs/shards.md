# Shard Workers

One of **7** identically deployed Cloudflare Workers that own real-time chat for deterministic conversation subsets. Each shard runs on its **own Cloudflare account** (Accounts 2–8) with its own D1, Durable Objects namespace, and Upstash Redis.

Shards are independent: no cross-shard traffic. Coordination:

- **Outbound:** batched metadata/unread callback to Account 1 every **5** messages
- **Inbound:** Account 1 → shard worker HTTP (`POST /api/messages`, `POST /api/admin/search`). Account 1 DO internal calls (`init-member`, etc.) target **Account 1's own DO**, not shards. Shards lazy-init members on first WS connect.

## Commands

```bash
cd apps/sharded-workers
pnpm dev              # wrangler dev (port 8787 by default)
pnpm generate         # drizzle-kit generate
pnpm cf-typegen
```

There is no `pnpm deploy:shards` script. Production deploys via `.github/workflows/deploy-shards.yml`.

## Structure

```
apps/sharded-workers/
├── drizzle/                 # D1 migrations (0000, 0001)
├── drizzle.config.ts
├── wrangler.jsonc           # single config; CI sed-replaces shard placeholders
└── src/
    ├── index.ts             # Hono: bearer auth, WS upgrade, admin search, lazy D1 init
    ├── do/ChatRoom.ts       # Durable Object: messages, presence, typing, reactions, alarms
    ├── db/                  # Drizzle schema (conversations, members, messages, reactions)
    ├── lib/
    │   ├── crypto.ts        # verifyBearerToken (HMAC)
    │   ├── upstash.ts       # REST Redis client + connection rate limit
    │   ├── circuit-breaker.ts
    │   └── logger.ts
    ├── routes/health.ts
    ├── env.ts               # required env validation
    └── types.ts
```

## Key files

| Path | Role |
|------|------|
| `src/index.ts` | Entry: CORS, env check, bearer auth, WS route, admin search proxy |
| `src/do/ChatRoom.ts` | Per-conversation DO (live messages, SQLite) |
| `src/lib/crypto.ts` | Stateless HMAC bearer verification |
| `src/lib/upstash.ts` | `INCR`/`EXPIRE` connect rate limit |
| `src/lib/circuit-breaker.ts` | Daily DO budget counter (in-memory) |
| `src/routes/health.ts` | D1 + Redis ping + breaker counters |
| `src/db/schema.ts` | Shard D1 tables |
| `wrangler.jsonc` | Bindings + `vars` (placeholders for CI) |

## Connection flow

1. Client obtains HMAC bearer from Account 1 (`GET /api/chat/ws-token`)
2. `wss://{shard}/ws/{conversationId}?token=…`
3. Worker verifies:
   - HMAC signature + expiry (5 min) — **`shard_id` claim not checked** (known gap)
   - Conversation id matches path
   - Circuit breaker not in `degrade`
   - Per-shard Upstash connection limit (`INCR rl:{userId}` + `EXPIRE 65`) — fails open on Redis errors
   - Lazy D1 membership bootstrap
4. Forward upgrade to `ChatRoom` DO with `X-User-Id`, role, tier headers (client identity headers overwritten)

## Rate limiting (Upstash)

- **Per-shard only** — each shard has a dedicated Upstash database; counters are **not** shared across shards. A user can hold `limit` connections *per shard* simultaneously.
- Used only on WebSocket connect (`INCR`/`EXPIRE`); health uses `PING`
- `INCR` and `EXPIRE` are not atomic — a crash between them can leave a key with no TTL (permanent lockout until manual delete) — known issue
- Fail-open on Redis errors (logged)

Do not confuse with Account 1's Cloudflare HTTP rate limits or DO message tiers.

## Durable Object budget / circuit breaker

- Free tier ~100k DO requests/day; `DAILY_DO_BUDGET=90000`, warn 0.70, degrade 0.90
- Degrade blocks **new** WS upgrades with 503
- Counter is **in-memory on the Worker isolate** (module singleton) — resets on isolate eviction; multiple isolates undercount; **not reconstructed from DO storage**
- Currently incremented only on: `init-member` forward and WS upgrade — **not** on `POST /api/messages` → DO, and not per in-DO WS message
- Malformed threshold values can yield `NaN` (breaker never opens) — edge case

## Callback to Account 1

Every **5** messages (`BATCH_UPDATE_INTERVAL` on the shard DO; Account 1 DO uses 100 for its own metadata updates):

```
POST https://api.batchup.fun/api/internal/shard-callback
Headers: X-Internal-API-Key: {ACCOUNT1_CALLBACK_API_KEY}
Body: {
  "updates": [{ "conversationId", "lastMessageAt", "lastMessagePreview", ... }],
  "unreadUpdates": [{ "conversationId", "userId", "delta" }]
}
```

Retries twice with 2s delay. Failures logged; message delivery not blocked. `messageCounter` is in-memory only (resets on DO eviction).

## Deployment

`.github/workflows/deploy-shards.yml`:

- Matrix `1..7` from `TOTAL_SHARDS: 7`
- Account index = shard + 1 → `CF_TK_{n+1}`, `CF_ACCOUNT_ID_{n+1}`
- D1 id from `DATABASE_ID_{shard}` (**shard-indexed**)
- `sed` replaces `shard-placeholder-db`, `"placeholder"`, `shard-placeholder-id`, `shard-placeholder-name` in `wrangler.jsonc`
- Secrets: `HMAC_SECRET`, `ACCOUNT1_CALLBACK_API_KEY`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`
- `wrangler deploy --name shard-{n} --minify` with `working-directory: apps/sharded-workers`

Manual `wrangler.shard-N.jsonc` files do **not** exist.

## Environment

**Required** (`src/env.ts`): `SHARD_ID`, `HMAC_SECRET`, `ACCOUNT1_CALLBACK_URL`, `ACCOUNT1_CALLBACK_API_KEY`, `UPSTASH_REDIS_URL`  

Also required in practice: `UPSTASH_REDIS_TOKEN` (read at runtime; missing from required list — known gap).

**Vars:** `SHARD_NAME`, `TOTAL_SHARDS`, `DAILY_DO_BUDGET`, `WARN_THRESHOLD`, `DEGRADE_THRESHOLD`

Wrong legacy names (do not use): `SHARD_CALLBACK_API_KEY` (server-side name), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DO_REQUEST_BUDGET`.

Full tables: [environment.md](./environment.md).

## Pitfalls

- `HMAC_SECRET` must equal Account 1 `SESSION_SECRET` exactly
- Shard D1 is local — conversations are not shared across shards
- DO SQLite is primary for live traffic; shard D1 also mirrors **messages and reactions** (not only metadata/members)
- Rate-limit state and breaker counts are in-memory (reset on hibernation/eviction)
- Dead/dangerous residue: `POST /nuke` DO endpoint (header-only auth, no callers); unused `WS_RATE_LIMITER` binding; sequence-column migration flag bug on pre-existing DO DBs
