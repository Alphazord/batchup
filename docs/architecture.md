# Architecture

## Overview

BatchUp is a real-time chat system (DMs + groups) designed for horizontal scale across **8 Cloudflare accounts**: 1 primary control plane (Account 1) + 7 shard Workers (Accounts 2–8).

Design targets (not guarantees): thousands of registered users, hundreds of concurrent connections, free-tier budgets where possible.

## High-level diagram

```
Browser (web app)
   │  cookie session (REST)
   ▼
Account 1 Worker (Hono) ──────────────► D1 (users, sessions,
   │  issues HMAC WS token               conversations, orders)
   │  FNV-1a shard routing
   │
   │  wss://shard-N/ws/:id?token=...
   ▼
Shard Worker N (Hono) ──► ChatRoom Durable Object (per conversation)
   │                          │  DO SQLite = live message store
   │                          │  WebSocket hibernation
   │                          ▼
   │                     Shard D1 mirror (messages, reactions,
   │                     conversations, members)
   │
   └── every 5 msgs ──► POST Account 1 /api/internal/shard-callback
                              (metadata + unread deltas only)
```

## Account 1 (control plane)

Responsibilities:

- Google OAuth (PKCE + state), session cookies (HMAC-hashed at rest)
- Conversation CRUD, membership, profiles, user search
- Deterministic shard assignment (`FNV-1a(conversationId) % TOTAL_SHARDS + 1`, 1-indexed)
- HMAC bearer issuance for WebSocket + history reads
- Razorpay order create/verify/webhook
- Admin API (API key)
- Internal callback receiver from shards
- Own `ChatRoom` DO for non-sharded/local conversations

## Shard workers

Seven identically deployed Workers, each with:

- Stateless HMAC verification of Account 1 tokens
- Per-conversation `ChatRoom` DO (source of truth for live messages: DO SQLite)
- Shard-local D1 (mirror of messages/reactions + conversation/member rows)
- Dedicated Upstash Redis (connection rate limit — **per shard**, not shared)
- In-memory circuit breaker on daily DO budget
- Health endpoint

Shards do not talk to each other. Coordination is only:

1. Shard → Account 1 batched metadata/unread callback
2. Account 1 → shard HTTP for history read and admin search

## ChatRoom Durable Object

One DO instance per conversation (`idFromName(conversationId)`):

- WebSocket hibernation; presence rebuilt from attachments on wake
- Message send/edit/delete, reactions (10-emoji allowlist), typing, read receipts
- In-memory tier-based rate limits (owner/admin bypass message rate limit)
- Membership checks before send

**Storage split (important):**

| Store | Contents | Sync |
|-------|----------|------|
| DO SQLite | Messages, reactions, members (live) | Primary write path |
| Shard D1 | Mirror of messages/reactions + conv/member rows | Written immediately with retry (shard DO) |
| Account 1 D1 | Canonical directory: users, conversations, members, orders; `messages` table used only as local fallback | Shard callback updates **metadata only** every 5 messages; Account 1 DO buffers message writes (500ms / 20 stmts) and updates metadata every 100 messages |

The two `ChatRoom` implementations (`apps/server` vs `apps/sharded-workers`) are parallel copies that have diverged (callback interval, buffering, rate-limit pruning, presence batching).

## Shard routing

1. `assignShard(conversationId, totalShards)` — FNV-1a, 1-indexed
2. Assignment is **deterministic**; stored `shard_id`/`shard_url` on the conversation row
3. ws-token and history paths **recompute** the shard and self-heal stale stored ids
4. Empty `SHARD_CONFIGS` ⇒ single-account mode (`shardUrl = null`, Account 1 DO)

> Changing `TOTAL_SHARDS` changes the hash mapping for existing IDs and can split-brain conversations. See [deployment.md](./deployment.md).

## WebSocket token flow

1. Client: `GET /api/chat/ws-token?conversationId=X` (session + membership)
2. Server signs HMAC bearer: user id, name/picture, conversation id, shard id, role, rate-limit tier/limits, conversation type/name, `exp` (+300s)
3. Returns `{ token, shardUrl }`
4. Client: `wss://{shardUrl}/ws/X?token={token}`
5. Shard verifies signature + exp + conversation id match (does **not** currently check `shard_id` claim — known gap), circuit breaker, Upstash connect limit, lazy D1 membership bootstrap, forwards upgrade to DO with identity headers (overwriting client-supplied identity headers)

## Rate limiting layers

| Layer | Where | Scope |
|-------|-------|-------|
| Cloudflare rate-limit bindings | Account 1 HTTP | Per IP, per route prefix (10/30/60 per 60s) |
| Upstash Redis `INCR rl:{userId}` | Each shard WS connect | **Per shard** (dedicated Redis per shard — not cross-shard) |
| DO in-memory sliding windows | Per conversation DO | Per user, tiered; owner/admin bypass on send |

Tier values enforced by the DO (e.g. normal ≈ 3/sec, 40/min). Note: `@repo/types` `RATE_LIMIT_TIERS` still disagrees (e.g. normal 5/sec) — UI may show wrong numbers (known issue).

## Presence & typing

- Presence: connection-counted per user; full or diff broadcasts; client prunes entries older than 2 minutes
- Server DO removes users when connection count hits 0
- Typing: 10s expiry; server DO throttles broadcasts to ~2s (shard DO broadcasts every event)

## Performance notes

- Message list virtualization and O(1) map lookups on the client
- `React.memo` on bubbles/member rows; memoized conversation filters
- Large-room broadcast batching exists on the **server** DO (>50 connections, chunks of 3 microtasks — microtasks do not yield the event loop)
- Shard DO currently loops sends without that batching

## Cost / free tier

Designed around free-tier limits (e.g. ~100k DO requests/day budget → `DAILY_DO_BUDGET=90000`, Upstash command budgets). Actual **$0/month is not guaranteed** — monitor usage. Circuit breaker is in-memory per isolate and undercounts globally (known limitation).
