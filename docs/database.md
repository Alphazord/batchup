# Database

## Overview

Two persistence layers plus DO SQLite:

| Store | Role |
|-------|------|
| Account 1 D1 (`realtime-chat-app`) | Canonical directory: users, accounts, sessions, conversations, members, orders; local `messages` fallback |
| Shard D1 (one per shard) | Mirror: conversations, members, messages, reactions |
| Durable Object SQLite | Live per-conversation store (authoritative for realtime traffic) |

Account 1 schema source: `apps/server/src/db/tables/*` + `apps/server/migrations/*.sql`.  
Shard schema: `apps/sharded-workers/src/db/schema.ts` + `apps/sharded-workers/drizzle/*.sql`.

> Timestamps in Drizzle tables are **TEXT ISO-8601** unless noted (`expires_at` on sessions is INTEGER unix seconds).

---

## Account 1 D1 tables

### users

| Column | Notes |
|--------|-------|
| `id` | PK (Google sub / provider account id link target via `accounts`) |
| `username` | UNIQUE |
| `email` | UNIQUE |
| `name`, `picture` | |
| `created_at`, `updated_at` | TEXT ISO |

Google identity lives on **`accounts`** (`provider`, `provider_account_id`), not a `google_id` column on users.

### accounts

| Column | Notes |
|--------|-------|
| `id` | PK |
| `user_id` | FK → users (CASCADE) |
| `provider`, `provider_account_id` | UNIQUE together |
| `refresh_token` | AES-GCM ciphertext (Google refresh token) |
| `expires_at` | |

### sessions

| Column | Notes |
|--------|-------|
| `id` | PK = `HMAC(SESSION_SECRET, raw_token)` hex (raw token never stored) |
| `user_id` | FK → users (CASCADE) |
| `expires_at` | INTEGER unix seconds |
| `ws_token`, `ws_token_expires_at` | Present in schema; **never written** by current code (dead path) |
| `created_at` | TEXT ISO |

### conversations

| Column | Notes |
|--------|-------|
| `id` | PK (`dm-{a}-{b}` or UUID) |
| `type` | `dm` \| `group` (app-level check; no SQL CHECK in Drizzle) |
| `name`, `description` | |
| `created_by` | FK → users |
| `member_count` | |
| `last_message_at`, `last_message_preview` | TEXT; preview excerpt |
| `rate_limit_tier`, `rate_limit_per_minute`, `rate_limit_per_second` | defaults normal / 40 / 3 |
| `shard_id` | INTEGER default **0** (0 = legacy/non-sharded) |
| `shard_url` | TEXT **nullable** |
| `created_at` | TEXT ISO |

### conversation_members

| Column | Notes |
|--------|-------|
| `conversation_id`, `user_id` | composite PK; FKs CASCADE |
| `role` | `owner` \| `admin` \| `member` |
| `last_read_at`, `joined_at` | TEXT ISO, defaults via `strftime` |
| `unread_count` | INTEGER; incremented via internal callback — **never decremented** (known bug) |

### messages

| Column | Notes |
|--------|-------|
| `id` | PK |
| `conversation_id` | FK CASCADE |
| `sender_id` | FK → users (no cascade); system messages use sender `"system"` (FK risk — known) |
| `content`, `type`, `reply_to_id`, `reply_count` | |
| `deleted_at`, `deleted_by`, `edited_at` | TEXT nullable |
| `created_at` | TEXT ISO |
| Index | `(conversation_id, created_at)` |

### message_reactions

| Column | Notes |
|--------|-------|
| `id` | PK |
| `conversation_id`, `message_id` | `message_id` has **no** FK |
| `user_id` | FK CASCADE |
| `emoji` | |
| Index | `(conversation_id, message_id)` |

### orders

| Column | Notes |
|--------|-------|
| `id` | PK |
| `user_id` | FK SET NULL (nullable — guests) |
| `product_id`, `product_name`, `amount`, `currency` | |
| `customer_name`, `customer_email` | |
| `razorpay_order_id`, `razorpay_payment_id` | UNIQUE |
| `razorpay_signature` | |
| `status` | pending / paid / failed |
| `failure_reason`, `paid_at`, timestamps | |

---

## DO SQLite

Created in each `ChatRoom.initSQLite`:

**Messages** — id, conversation_id, sender_id, content, type, reply_to_id, reply_count, deleted_at/by, edited_at, created_at; shard DO also has **`sequence`** (migration adds it to old DBs; known bug: `hasSequence` flag not set after ALTER).

**Message reactions** — autoincrement `id` (shard); not composite-PK-only.

**Members** — `user_id`, `role`, `joined_at`, `last_read_at` (no name/picture columns).

**Pending unreads** — shard DO only (`pending_unreads`).

---

## DO ↔ D1 sync (accurate as of code)

| Path | Behavior |
|------|----------|
| Shard DO message write | DO SQLite sync → shard D1 **immediate** `waitUntil` + 3× retry (not buffered 500ms/20) |
| Shard → Account 1 | HTTP callback every **5** messages: metadata (`lastMessageAt`, preview) + unread deltas. **No message content.** |
| Account 1 DO message write | DO SQLite sync → **buffered** D1 SQL (flush every 500ms or 20 statements, 3 retries) |
| Account 1 DO metadata | Direct D1 `UPDATE conversations` every **100** messages (in-process, not HTTP callback) |
| Account 1 `messages` table | Read as history fallback; **not populated by shards** |

Known consistency issues: DO buffer window can lose writes if DO dies; system messages may violate `sender_id` FK on D1; unread_count increment-only (see [../fixes/FINDINGS.md](../fixes/FINDINGS.md)).

---

## Commands

No root `db:*` scripts.

```bash
# Account 1
cd apps/server
pnpm generate    # drizzle-kit generate → migrations/
pnpm studio
npx wrangler d1 migrations apply realtime-chat-app --local|--remote
npm run migrate  # helper; known path bug (reads ./drizzle not ./migrations)

# Shards
cd apps/sharded-workers
pnpm generate
pnpm amend
npx wrangler d1 migrations apply <shard-db-name> --local|--remote
```

Drizzle configs use `d1-http` and need `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_ID`, `CLOUDFLARE_API_TOKEN`.

---

## Pitfalls

- D1: use `db.batch()`, not raw `db.transaction()` (no BEGIN support as used here).
- DO SQLite is only queryable through the DO (internal `x-do-internal` endpoints / code paths).
- Eventual consistency between DO SQLite and D1 mirrors is by design.
- `PRAGMA foreign_keys = ON` is issued per-request in `apps/server/src/db/index.ts` (promise currently not awaited — known defect; D1 FK behavior should be verified).
