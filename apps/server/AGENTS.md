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

# BatchUp Chat System — Server Development Guide

## Architecture Overview

The server (`apps/server/`) is Account 1's Cloudflare Worker. It handles:
- Google OAuth authentication + session management
- Conversation CRUD (DMs and groups)
- User management and search
- Payment processing (Razorpay)
- WebSocket token issuance (HMAC-signed bearer tokens)
- Shard routing (FNV-1a hash-based)
- Internal shard callback receiver (metadata sync from shards)

The server does NOT handle real-time messaging directly. That's delegated to 7 sharded Workers via Durable Objects.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Hono app entry, middleware stack (rate limiting, body limit, security headers, CORS) |
| `src/routes/auth.ts` | Google OAuth flow, session management, token refresh |
| `src/routes/chat.ts` | Conversations, members, messages history, profiles, WebSocket upgrade, rate limits (largest route file) |
| `src/routes/admin.ts` | Admin GET API + shard fan-out search |
| `src/routes/internal.ts` | Shard callback receiver — receives batched metadata updates from shards |
| `src/routes/payment.ts` | Razorpay order creation, verification, webhook |
| `src/routes/health.ts` | Health check with shard ping |
| `src/do/ChatRoom.ts` | Durable Object for non-sharded conversations — WebSocket, messages, presence, typing, reactions, rate limiting, DO SQLite |
| `src/lib/shard-router.ts` | FNV-1a hash-based shard assignment (`assignShard`, `getShardUrl`, `parseShardConfigs`) |
| `src/lib/crypto.ts` | HMAC-SHA256 session hashing + bearer token signing |
| `src/db/tables/conversations.ts` | Conversations + conversation_members tables (includes `shard_id`, `shard_url`) |
| `wrangler.jsonc` | D1, DO, and rate-limit bindings; `TOTAL_SHARDS` currently under `"env"` (should be `"vars"` — known issue) |

## Shard Routing

Conversations are assigned to shards via FNV-1a hash:
```typescript
// src/lib/shard-router.ts
function assignShard(conversationId: string, totalShards: number): number {
  let hash = 2166136261;
  for (let i = 0; i < conversationId.length; i++) {
    hash ^= conversationId.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return (hash % totalShards) + 1; // 1-indexed (Account 2 = shard 1)
}
```

- Assignment is **deterministic** from `conversationId` + `TOTAL_SHARDS`
- Stored `shard_id`/`shard_url` can be **stale**; ws-token and history paths recompute and may rewrite them (self-heal)
- Do not change `TOTAL_SHARDS` without a data migration (changes `hash % N` for existing IDs — no migration tool exists)
- `SHARD_CONFIGS` env var: JSON array of shard `{ id, name, url, cfAccountId }` (`kvNamespace` unused)
- **`TOTAL_SHARDS` code default is 8** if unset (`parseInt(...) || 8`); wrangler intends 7 (known mismatch — see `fixes/FINDINGS.md` BUG 6)

## WebSocket Token Flow

1. Client calls `GET /api/chat/ws-token?conversationId=X` (session + membership)
2. Server **recomputes** shard from conversation id (self-heals stale stored ids), loads conversation metadata
3. Server signs HMAC bearer token with payload: `{ user_id, name, picture, conversation_id, shard_id, role, rate_limit_tier, rate_limit_per_second, rate_limit_per_minute, conversation_type, conversation_name, exp }`
4. Returns `{ token, shardUrl }` to client
5. Client connects WebSocket to `wss://{shardUrl}/ws/{conversationId}?token={token}`

History reads use a separate 30s bearer to `POST {shardUrl}/api/messages`.

## Durable Object (ChatRoom)

One DO instance per conversation (Account 1-local / non-sharded path). Key behaviors:
- **WebSocket hibernation** — DO survives idle periods, rebuilds presence from active connections
- **SQLite storage** — messages, message_reactions, members (co-located with DO, NOT D1)
- **In-memory rate limiting** — per-user sliding window, tier-based; 60s cleanup timer
- **D1 message writes** — buffered (500ms / 20 statements, 3 retries)
- **Metadata** — direct D1 `UPDATE conversations` every 100 messages (in-process; this app does **not** HTTP-callback itself)
- **Presence** — `connectedUsers` with connection counting; removed on disconnect
- **Typing** — auto-expiry after 10 seconds; broadcast throttled ~2s
- **`alarm()`** is present but never armed in the constructor (known dead D1-flush safety net)

Shard Workers ship a **separate, diverged** `ChatRoom` under `apps/sharded-workers` (callback every 5 messages, immediate D1 mirror, etc.).

## Rate Limiting

1. **HTTP (Cloudflare bindings)** — per IP, per route prefix (10/60s auth, 30/60s payments, 60/60s chat/admin/internal)
2. **DO in-memory** — per user, per conversation (tier-based: normal ≈ 3/sec, 40/min; owner/admin bypass on send)

Upstash Redis is **not** used by this app (shards only, and per-shard — not cross-shard).

## Internal Shard Callback

Shards call `POST /api/internal/shard-callback` with `X-Internal-API-Key` every **5** messages (shard DO `BATCH_UPDATE_INTERVAL`; Account 1's own DO uses 100 for direct metadata updates):
```json
{
  "updates": [{ "conversationId": "...", "lastMessageAt": "...", "lastMessagePreview": "...", "memberCount": 5 }],
  "unreadUpdates": [{ "conversationId": "...", "userId": "...", "delta": 1 }]
}
```
Receiver updates `lastMessageAt`/`lastMessagePreview` and unread deltas. `memberCount` in the payload is **ignored** (Account 1 owns member counts).

## Environment Variables

Validated by `src/env.ts` — see `docs/environment.md` for full tables.

**Required:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `WEB_APP_URL`, `ALLOWED_ORIGINS`

**Optional:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SHARD_CONFIGS`, `TOTAL_SHARDS` (code default 8), `SHARD_CALLBACK_API_KEY`, `ADMIN_API_KEY`

## Common Pitfalls

- **Foreign keys:** `PRAGMA foreign_keys = ON` in `src/db/index.ts` per request (promise currently not awaited — known defect)
- **D1 uses `db.batch()` not `db.transaction()`**
- **DO internal endpoints require `x-do-internal: true`:** otherwise 403
- **Bearer TTL** checked at upgrade, not mid-session
- **`signBearerToken` uses `btoa`:** throws on non-Latin1 characters in names (known bug)
- **Resharding is unsafe** without migration tooling
