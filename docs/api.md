# API Reference

Base URL: `https://api.batchup.fun`

## Authentication

Most endpoints require a session:

- Cookie: `session` (httpOnly, sent automatically with `credentials: "include"`), **or**
- Header: `Authorization: Bearer <session-token>` (43-char token)

**Exceptions (not session-authenticated):**

| Route | Auth mechanism |
|-------|----------------|
| `GET /health` | None |
| `GET /auth/google`, `GET /auth/google/callback` | OAuth state/PKCE cookies |
| `POST /payments/webhook` | Razorpay HMAC signature |
| `POST /payments/verify-order` | Razorpay payment signature |
| `POST /payments/create-order` | Optional session (guest checkout allowed) |
| `POST /api/internal/shard-callback` | `X-Internal-API-Key` |
| `/*` under `/api/admin` | `X-Admin-API-Key` |
| Shard `GET /ws/:id`, `POST /api/messages` | HMAC bearer (minted by Account 1) |

Conversation-scoped routes additionally require **membership** in that conversation. Role gates: `owner` / `admin` for member management, group settings, and rate-limit changes.

---

## Auth (`/auth`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Start Google OAuth (state + PKCE cookies) |
| GET | `/auth/google/callback` | OAuth callback; sets session cookie; redirects to `WEB_APP_URL` |
| GET | `/auth/me` | Current user; may rotate session cookie (sliding expiry) |
| POST | `/auth/logout` | Delete session; clear cookie (Origin checked) |
| POST | `/auth/refresh` | Refresh Google access token via stored refresh token (only after token expiry) |

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | D1 ping + per-shard ping (latency, D1, Redis, circuit breaker). No auth. |

## Chat (`/api/chat`)

All require session unless noted. Rate limited with `CHAT_RATE_LIMITER` (60/60s per IP).

### Users & profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/users/search?q=` | Search users by name/email (excludes self, limit 20) |
| GET | `/api/chat/profile/me` | Current user profile |
| PUT | `/api/chat/profile` | Update name / username |

### Conversations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/conversations` | List conversations for current user |
| POST | `/api/chat/conversations` | Create DM (`type: "dm"`, one `memberIds`) or group (`type: "group"`, name) |
| GET | `/api/chat/conversations/:id` | Get conversation (member only) |
| PUT | `/api/chat/conversations/:id` | Update name/description (owner/admin) |
| DELETE | `/api/chat/conversations/:id` | Leave/delete (DM: either party deletes whole conversation; group owner cannot leave) |
| POST | `/api/chat/conversations/:id/read` | Mark conversation read (`lastReadAt`) |

### Members

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/conversations/:id/members` | List members |
| POST | `/api/chat/conversations/:id/members` | Add member (owner/admin) |
| DELETE | `/api/chat/conversations/:id/members/:userId` | Remove member (owner/admin; cannot remove owner) |

### Messages (history)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/conversations/:id/messages` | **Load** message history (body `{ cursor?, limit? }`, limit 1–100). Proxies to shard DO when sharded; falls back to Account 1 D1 then Account 1 DO. **Not a send endpoint** — sending is WebSocket-only. |

### WebSocket token & upgrade (Account 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/ws-token?conversationId=` | Session + membership; returns `{ token, shardUrl }` (HMAC bearer, 300s TTL) |
| GET | `/api/chat/ws/:conversationId` | Upgrade to Account 1 `ChatRoom` DO (non-sharded/legacy path). Auth: session cookie or single-use `?token=` |

Clients normally connect to the **shard** directly: `wss://{shardUrl}/ws/{conversationId}?token={token}`.

### Rate limits (conversation)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/conversations/:id/rate-limit` | Read tier + limits (member) |
| PUT | `/api/chat/conversations/:id/rate-limit` | Set tier/custom limits (owner/admin) |

### Debug

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/debug/memberships` | Caller's own memberships only. Session required; **no environment gate** (known issue). |

### WebSocket client protocol (DO)

Sending, editing, deleting, reactions, typing, and read receipts are **WebSocket-only** (handled inside the Durable Object):

- `message_send`, `message_edit`, `message_delete`
- `reaction_add`, `reaction_remove`
- `typing_start`, `typing_stop`
- `message_read`
- `ping` (shard DO only)

There is **no** REST route for send/edit/delete/reactions.

---

## Payments (`/payments`)

Rate limited with `SESSION_RATE_LIMITER` (30/60s per IP).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/create-order` | optional session | Creates order from **server catalog** amount (client amount ignored for pricing). Catalog currently empty → always 400. |
| POST | `/payments/verify-order` | Razorpay signature | HMAC verify + server-side amount re-fetch |
| POST | `/payments/webhook` | `X-Razorpay-Signature` | Raw-body HMAC; handles `payment.captured` / `payment.failed` |

---

## Internal (`/api/internal`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/internal/shard-callback` | `X-Internal-API-Key` | Batched `{ updates[], unreadUpdates[] }` from shards. Caps: 100 updates, 1000 unread updates. Updates `lastMessageAt`/`preview` + unread deltas. `memberCount` in payload is intentionally ignored. |

---

## Admin (`/api/admin`)

All routes: `X-Admin-API-Key` (constant-time; 503 if `ADMIN_API_KEY` unset) + 60/60s IP rate limit. All are **GET**.

| Path | Description |
|------|-------------|
| `/api/admin/stats` | KPIs |
| `/api/admin/stats/timeline` | Timeline series |
| `/api/admin/users` | Paginated users |
| `/api/admin/users/:id` | User detail + conversations |
| `/api/admin/conversations` | Paginated conversations |
| `/api/admin/conversations/:id` | Conversation detail + members |
| `/api/admin/messages` | Message search (fans out to shards) |
| `/api/admin/orders` | Orders |
| `/api/admin/orders/stats` | Order/revenue stats |
| `/api/admin/shards` | Shard health |
| `/api/admin/system` | DB/session/system health |

Full handlers: `apps/server/src/routes/admin.ts`.

---

## HTTP rate limits (Account 1)

| Prefix | Limiter | Limit |
|--------|---------|-------|
| `/auth/*` | `AUTH_RATE_LIMITER` | 10 / 60s per IP |
| `/payments/*` | `SESSION_RATE_LIMITER` | 30 / 60s per IP |
| `/api/chat/*`, `/api/internal/*`, `/api/admin/*` | `CHAT_RATE_LIMITER` | 60 / 60s per IP |

Shard workers: separate limits (Upstash on WS connect; optional unused `WS_RATE_LIMITER` binding).

## Errors

JSON shape: `{ "error": string }` (plus occasional extra fields). Common codes: 400 validation, 401 unauthenticated, 403 forbidden/origin, 404 not found, 409 conflict, 429 rate limit, 500 generic internal, 502 shard failure, 503 misconfigured/unavailable.

Global handlers avoid stack traces; env-validation 500 may include a `missing` array of variable **names** (known minor disclosure).
