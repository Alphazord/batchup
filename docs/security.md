# Security

## Model summary

Server-mediated chat (no end-to-end encryption). Account 1 owns identity and authorization; shards trust short-lived HMAC bearer tokens minted by Account 1.

## Authentication

### Google OAuth 2.0

- Authorization code + **PKCE S256** + random `state` (httpOnly cookies, 10 min)
- State compared in constant-time (`validateState`)
- Userinfo over TLS; `id_token` is not signature-verified (identity comes from userinfo)
- Refresh tokens stored **AES-256-GCM encrypted** under `SESSION_SECRET` (PBKDF2-SHA256 100k iterations; salt string is still scaffold residue `saas-launchkit-refresh-token` — known)

### Sessions

- 32 random bytes → 43-char base64url token in cookie `session`
- DB stores only `HMAC-SHA256(SESSION_SECRET, token)` — raw token never persisted
- Cookie: `httpOnly`, `Secure` (when HTTPS), `SameSite=Lax`, `Path=/`, max-age 7 days, `Domain=.batchup.fun` (superdomain — any hostile subdomain receives the cookie)
- Single-session policy: login deletes prior sessions
- Sliding rotation when &lt;50% of lifetime remains (`GET /auth/me`)
- `POST /auth/refresh` refreshes the **Google access token only after it expires** (not at &lt;50% lifetime — that rule applies to session rotation only)
- Logout: explicit Origin check + session delete

### Bearer tokens (shards)

- HMAC-SHA256 with derived key `HMAC(SESSION_SECRET, "bearer-token-key")`
- Format: `base64url(payload).hex(signature)`
- WS tokens: 300s TTL; history-read tokens: 30s
- Shards verify statelessly; **do not currently enforce `shard_id` claim** and treat missing `exp` as non-expiring (known gaps)
- Account 1 local `/ws` path also supports a DB `ws_token` column that is never written (dead)

### Admin

- Static `X-Admin-API_KEY` (constant-time compare)
- Fail-closed 503 if `ADMIN_API_KEY` unset
- Admin app stores the key in **`localStorage`** (known weakness: XSS could exfiltrate; CSP includes `script-src 'unsafe-inline'`)

### Internal shard callback

- `X-Internal-API-Key` constant-time vs `SHARD_CALLBACK_API_KEY`
- Fail-closed when unset
- Shared key across all shards (no per-shard identity)

## Authorization

- Every conversation REST route: session + membership check
- Role gates: owner/admin for settings, member add/remove, rate-limit config
- Message ops inside DO: membership via DO member set/table; edit = author only (15 min window); delete = author or owner/admin
- Shard HTTP (`/api/messages`, `/api/admin/search`): valid Account 1-signed bearer only

## Cryptography

| Use | Algorithm |
|-----|-----------|
| Session lookup | HMAC-SHA256 |
| Bearer sign/verify | HMAC-SHA256 (derived key) |
| Refresh token at rest | AES-256-GCM + PBKDF2-SHA256 (100k) |
| OAuth state / PKCE | random 32 bytes; S256 challenge |
| Razorpay verify / webhook | HMAC-SHA256, constant-time compare |
| API keys | constant-time string compare |

## Transport & browser

- HTTPS/HSTS on API and Next apps
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
- CORS: Account 1 uses `ALLOWED_ORIGINS` allowlist + `credentials: true`; shards hardcode `https://batchup.fun` and `https://www.batchup.fun`
- Web CSP in `next.config.ts` (script/style/connect restrictions; `script-src` allows `'unsafe-inline'`)
- `public/_headers` duplicates some headers **without CSP** — which responses get CSP needs live verification
- Body limit 1 MB on Account 1

## Rate limiting

| Layer | Scope |
|-------|-------|
| Cloudflare HTTP rate limits | Per IP on Account 1 (auth 10/60s, payments 30/60s, chat/admin/internal 60/60s) |
| Upstash | **Per-shard** WS connect limit (dedicated Redis per shard — not cross-shard escalation) |
| DO in-memory | Per conversation message tiers; owner/admin bypass |

IP key: `CF-Connecting-IP` (fallback `"unknown"` shares one bucket).

## Payments

- Order amount always from **server catalog** — client `amount` is validated but not trusted for pricing
- Verify-order: signature + re-fetch order from Razorpay + amount equality
- Webhook: raw-body HMAC with `RAZORPAY_WEBHOOK_SECRET` (fail-closed if unset)
- Only publishable `keyId` reaches the browser
- Known: webhook amount mismatch silently returns success; guest pending-order reuse compares `""` vs `null`; catalog empty so create-order always 400

## Data protection

- No E2E encryption — operators of Account 1 and shards can read message content in DO/D1
- Message previews stored on Account 1 (PII)
- Admin can search messages across shards (no admin audit log — known)
- Google refresh tokens encrypted at rest

## CSP / XSS notes

- No `dangerouslySetInnerHTML` anywhere in the repo
- Avatars restricted to `https:` on input; CSP `img-src` further limits hosts
- Residual XSS risk centers on admin `localStorage` key + inline script allowance

## Known limitations (honest list)

Tracked in [../fixes/FINDINGS.md](../fixes/FINDINGS.md):

1. Sharded message history not synced to Account 1; client can render failures as empty history
2. `unread_count` increments but never decrements
3. `TOTAL_SHARDS` default/config mismatch (code 8 vs intended 7; wrangler key placement)
4. Lazy D1 membership init race
5. Shard `rateLimits` map not evicted (server DO has a 60s cleaner)
6. Debug route `/api/chat/debug/memberships` exposed without env gate
7. Admin key in localStorage; CSP `unsafe-inline`
8. Superdomain session cookie (`.batchup.fun`)
9. Partial CSRF reliance on SameSite=Lax (no CSRF tokens except logout Origin check)
10. Circuit breaker is per-isolate memory, incomplete call counting
11. Upstash INCR/EXPIRE not atomic (possible permanent lockout)
12. No app-level automated security tests
13. Public `/health` on server and shards discloses internal topology/telemetry
14. Empty payment catalog / dead checkout UI

This document describes **intended controls as implemented**. It is not a substitute for an external security review.
