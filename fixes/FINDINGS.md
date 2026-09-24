# BatchUp — Technical Due Diligence Findings

**Last reviewed:** 2026-09-24 (documentation rectification pass — statuses and line references refreshed against current source).

Line numbers are approximate and will drift; prefer symbol names.

---

## Critical Bugs

### BUG 1: Messages Disappear After Browser Refresh

**Severity:** CRITICAL  
**Confidence:** 100%  
**Status:** **Partially fixed — residual risk remains**

**Description:**  
After browser refresh, chat messages can vanish: conversation list works (metadata), but the message pane shows empty.

**Original root cause:**  
History was read only from Account 1 D1/DO, which shards never populate with message content (callback syncs metadata only).

**What changed:**  
`POST /api/chat/conversations/:id/messages` now **forwards to the shard** (`POST {shardUrl}/api/messages` with a 30s bearer) before falling back to Account 1 D1 and Account 1 DO.

**Residual issues (still open):**
1. Client `loadMessages` (`apps/web/src/contexts/chat-context.tsx`) catches errors and returns `[]` — failures are indistinguishable from an empty room.
2. Account 1's `messages` table is still never backfilled by shards — fallbacks remain empty for sharded conversations if the shard call fails.
3. Shard admin search joins a `users` table that shard D1 migrations do not create (feature broken as coded).

**Evidence (current):**
- `apps/server/src/routes/chat.ts` — history endpoint (shard proxy → D1 fallback → Account 1 DO)
- `apps/server/src/routes/internal.ts` — callback updates metadata/unread only, never message rows
- `apps/sharded-workers/src/do/ChatRoom.ts` — `persistMessageToD1` writes **shard** D1 only
- `apps/web/src/contexts/chat-context.tsx` — `loadMessages` → `return []` on error

**Impact if residual issues hit:** history appears empty or errors are silent after refresh when shard read fails.

**Remaining fix:** surface load errors in the UI; consider authoritative reads from shard only; backfill or drop Account 1 message fallback semantics; fix shard admin `users` join.

---

## Medium Bugs

### BUG 2: Unread Count Never Decrements on Message Read

**Severity:** Medium  
**Confidence:** 100%  
**Status:** **Open**

**Description:**  
`conversation_members.unread_count` only increments (via shard callback) and is never decremented on read. UI often uses `lastMessageAt > lastReadAt` instead.

**Evidence:**
- `apps/sharded-workers/src/do/ChatRoom.ts` — `pendingUnreadUpdates` increments
- `apps/server/src/routes/internal.ts` — applies positive/negative deltas from callback (increments from sends)
- `apps/server/src/routes/chat.ts` — `POST .../read` sets `lastReadAt` only; DO `/mark-read` updates `last_read_at`, not D1 `unread_count`

**Impact:** stale unread column; badge logic depends on `lastReadAt` workaround.

---

### BUG 3: Race in Lazy D1 Membership Init (Shard Worker)

**Severity:** Medium  
**Confidence:** 95%  
**Status:** **Open**

**Description:**  
Non-atomic check-then-create for conversation/member rows on first WS connect.

**Evidence:** `apps/sharded-workers/src/index.ts` — lazy bootstrap path (select membership → maybe insert).

**Impact:** duplicate/failed init under concurrent first connections.

---

## Low Bugs

### BUG 4: Rate Limit Map Growth in DO

**Severity:** Low  
**Confidence:** 100%  
**Status:** **Half-fixed**

**Description:**  
`rateLimits` Map not cleaned on disconnect.

**Reality:**
- **Server DO:** mitigated — 60s `cleanupRateLimits` timer (`apps/server/src/do/ChatRoom.ts`).
- **Shard DO:** still open — prunes windows on each check but never removes idle users' entries (only `/nuke` clears the map).

**Evidence:** `webSocketClose` does not touch `rateLimits` in either DO.

---

### BUG 5: Conversation Preview Stale for Very New Conversations

**Severity:** Low  
**Confidence:** 100%  
**Status:** **Largely obsolete (threshold now 5)**

**Description:**  
Preview on Account 1 updates on shard callback batch interval.

**Reality:** shard `BATCH_UPDATE_INTERVAL = 5` (was 100). Conversations with **&lt;5** messages (and no other callback) may still show stale/"No messages yet" previews. Account 1 DO path still batches metadata every **100**.

**Evidence:**
- `apps/sharded-workers/src/do/ChatRoom.ts` — `BATCH_UPDATE_INTERVAL = 5`
- `apps/server/src/routes/internal.ts` — applies metadata on callback
- `apps/server/src/do/ChatRoom.ts` — interval 100 for local DO metadata

---

### BUG 6: TOTAL_SHARDS Default / Config Mismatch

**Severity:** Low (operational High if triggered)  
**Confidence:** 100%  
**Status:** **Open**

**Description:**  
Code fallback for `TOTAL_SHARDS` is **8**; deployment intends **7**.

**Evidence:**
- `apps/server/src/routes/chat.ts` and `routes/admin.ts` — `parseInt(...) || 8`
- `apps/server/wrangler.jsonc` — `"TOTAL_SHARDS": "7"` nested under **`"env"`** (named-environment map), **not** `"vars"` — may never inject as a plain var (generated types omit it)
- `apps/sharded-workers/wrangler.jsonc` — correctly under `vars`, value `7`

**Impact:** if Account 1 runs without the var, assignment can target non-existent shard 8 and degrade routing.

**Fix:** move to `vars`/dashboard, align code default to 7, assert `SHARD_CONFIGS.length === TOTAL_SHARDS` at deploy.

---

### BUG 7: Debug Endpoint Exposed in Production

**Severity:** Low  
**Confidence:** 100%  
**Status:** **Open (reduced surface)**

**Description:**  
`GET /api/chat/debug/memberships` is available without an environment gate (session required; returns **caller's own** memberships only).

**Evidence:** `apps/server/src/routes/chat.ts` — debug route near end of file.

**Note:** `/api/chat/debug/conversations` **no longer exists** (removed).

**Impact:** low sensitivity info disclosure; still should be gated or removed in production.

---

## Additional findings (2026-09 audit)

### A. Empty product catalog breaks payments

**Severity:** High (functional)  
`packages/products` — `PRODUCTS = []`; `create-order` always 400 "Unknown product". `razorpay-button.tsx` is unmounted. Payments non-functional as shipped.

### B. Shard sequence migration never activates

**Severity:** Medium  
`apps/sharded-workers/src/do/ChatRoom.ts` — after `ALTER TABLE ... sequence`, code rechecks the **stale** pre-ALTER column list; `hasSequence` stays false on migrated DOs.

### C. `envValidated` fail-open after first request

**Severity:** High  
`apps/server/src/index.ts` — sets `envValidated = true` before checking validation result; subsequent requests proceed with missing env (and 500 body may list missing var names).

### D. `signBearerToken` uses `btoa`

**Severity:** Medium  
`apps/server/src/lib/crypto.ts` — throws on non-Latin1 payload characters (emoji/CJK names) → ws-token 500.

### E. Server DO `alarm()` never armed

**Severity:** Medium  
`apps/server/src/do/ChatRoom.ts` — only `setAlarm` is inside `alarm()`; constructor never schedules it. D1 buffer flush safety net never runs. Shard DO arms its alarm.

### F. System messages vs `sender_id` FK

**Severity:** Medium (verify D1 FK enforcement)  
System inserts use `sender_id = "system"` while `messages.sender_id` references `users(id)`.

### G. Upstash INCR/EXPIRE non-atomic + fail-open

**Severity:** Medium  
`apps/sharded-workers/src/lib/upstash.ts` — TTL only set when count==1; Redis errors fail open; `UPSTASH_REDIS_TOKEN` not in required env.

### H. Shard `shard_id` claim not verified; optional `exp`

**Severity:** Medium  
`apps/sharded-workers/src/index.ts` + `lib/crypto.ts` — wrong-shard connect can materialize DO state on wrong shard; exp-less tokens immortal.

### I. Destructive DO `/nuke` with header-only auth

**Severity:** Medium (defense-in-depth)  
`apps/sharded-workers/src/do/ChatRoom.ts` — no callers; guard is `x-do-internal: true` only.

### J. PRAGMA foreign_keys promise not awaited

**Severity:** Medium  
`apps/server/src/db/index.ts` — `db.run(PRAGMA ...)` dropped.

### K. Guest pending-order reuse compares `""` vs `null`

**Severity:** Low  
`apps/server/src/routes/payment.ts` — guest reuse never matches.

### L. Webhook amount mismatch returns success silently

**Severity:** Medium  
`apps/server/src/routes/payment.ts` — mismatched `payment.captured` breaks without alerting; still `{success:true}`.

### M. Public health discloses internals

**Severity:** Low  
`routes/health.ts` (server + shards) — unauthenticated shard URLs / telemetry.

### N. Rate-limit tier values disagree (`@repo/types` vs DO)

**Severity:** Low  
UI `RATE_LIMIT_TIERS` (e.g. normal 5/s) ≠ DO enforcement (normal 3/s).

### O. Zero app-level tests

**Severity:** Medium (quality)  
No tests under `apps/*`; packages have shallow unit tests only.

### P. EULA/LICENSE template residue (docs pass)

**Severity:** Low (process)  
Addressed in documentation rectification: repo relicensed **AGPL-3.0** under Alphazord; EULA replaced with open-source notice; `LICENSES.md` rewritten. Crypto salt / test fixture / `public/index.html` branding residue still in **code** (out of scope for docs pass).

---

## Architectural Issues

### 1. Dual persistence without full synchronization
DO SQLite (live) + shard D1 mirror + Account 1 directory. Account 1 `messages` table never receives shard traffic. Confusion about source of truth for history.

### 2. Shard callback doesn't sync message content
By design today — history must be read from the shard. Account 1 cannot serve sharded history if shard is down.

### 3. No offline/local persistence
No IndexedDB/message localStorage in the web app; every refresh is a full round-trip.

### 4. WebSocket URL construction fragility
Client builds WS URLs from `shardUrl` string parsing; failures are easy to miss.

### 5. Circuit breaker is per-isolate, incomplete counting
Shared only within one Worker isolate; not reconstructed from storage; not all DO calls counted; popular-conversation bursts can degrade a whole shard's new connections when the counter is high.

### 6. Forked ChatRoom DOs
`apps/server` vs `apps/sharded-workers` ChatRoom implementations have diverged (interval 100 vs 5, buffering vs immediate, presence batching, rate-limit cleanup, `/nuke`, sequence). Highest maintenance risk in the repo.

### 7. Resharding has no migration tooling
Changing `TOTAL_SHARDS` remaps `hash % N`; ws-token self-heal can rewrite `shard_id` while data stays on the old shard.
