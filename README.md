# BatchUp — Real-Time Chat System

**An [Alphazord](https://alphazord.space) product.**

Real-time chat application built on Cloudflare Workers, Durable Objects, and Next.js. Supports DMs, group chats, typing indicators, presence, reactions, read receipts, and conversation-admin configurable rate limits.

Horizontally sharded across **8 Cloudflare accounts** (1 primary + 7 shards). Designed to fit within Cloudflare and Upstash **free tiers** — verify current platform limits and your usage before relying on a $0 cost.

## Quick Start

There is no root `dev` script. Install once, then run apps individually:

```bash
pnpm install

# Terminal 1 — API (Account 1 Worker) → http://localhost:8787
pnpm --filter @repo/server dev

# Terminal 2 — Web app → http://localhost:3000
pnpm --filter @repo/web dev

# Optional — admin dashboard
pnpm --filter @repo/admin dev

# Optional — a local shard worker (wrangler defaults to 8787; use --port to run beside the server)
pnpm --filter @repo/sharded-workers exec wrangler dev --port 8788
```

Root quality commands:

```bash
pnpm test        # vitest (packages only — apps have no tests yet)
pnpm lint
pnpm typecheck   # nx run-many -t typecheck (does not cover @repo/web)
```

See [docs/setup.md](./docs/setup.md) for environment files and database migrations.

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/index.md](./docs/index.md) | Documentation hub |
| [docs/architecture.md](./docs/architecture.md) | System overview, data flow, shard routing |
| [docs/server.md](./docs/server.md) | Account 1 Worker — auth, REST API, DO lifecycle |
| [docs/web.md](./docs/web.md) | Next.js 16 frontend — chat UI, WebSocket client |
| [docs/shards.md](./docs/shards.md) | 7 sharded Workers — Durable Objects, broadcasting |
| [docs/database.md](./docs/database.md) | D1 schema, DO SQLite, migrations |
| [docs/api.md](./docs/api.md) | REST endpoint reference |
| [docs/security.md](./docs/security.md) | Security model, encryption, auth, known limitations |
| [docs/deployment.md](./docs/deployment.md) | CI/CD, Cloudflare setup, environment config |
| [docs/environment.md](./docs/environment.md) | All environment variables reference |
| [docs/setup.md](./docs/setup.md) | Local development setup |

## Known Limitations

Open findings and bug status live in [fixes/FINDINGS.md](./fixes/FINDINGS.md). Highlights:

- **Message history after refresh:** sharded conversations load history via the shard DO; Account 1's `messages` table is not backfilled by shards. The web client can also surface load failures as an empty list.
- **`TOTAL_SHARDS` hazard:** if the env var is unset, server code falls back to **8** while the deployment intends **7**; `wrangler.jsonc` also places `TOTAL_SHARDS` under the wrong config key (known issue). Do not change `TOTAL_SHARDS` without a data-migration plan (none exists).
- **Rate limiting is per-shard:** Upstash Redis is **not** shared across shards; each shard enforces its own connect limit. HTTP rate limits (Cloudflare bindings) and DO in-memory message limits are separate layers.
- **Payments are non-functional as shipped:** the product catalog (`@repo/products`) is empty and the checkout component is unmounted, so order creation always fails.
- **Admin credential:** the admin dashboard stores a static API key in `localStorage` (XSS-exfiltration risk if an XSS primitive exists).
- **Tests:** only a few package-level unit tests exist; there are **no app-level tests** for auth, payments, chat, or sharding.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS v4 |
| Backend | Hono.js on Cloudflare Workers |
| Database | Cloudflare D1 + Durable Object SQLite |
| Real-time | Cloudflare Durable Objects (WebSocket hibernation) |
| Rate limiting | Cloudflare rate-limit bindings + per-shard Upstash Redis (WS connect) + DO in-memory tiers |
| Auth | Google OAuth 2.0 (PKCE) + HMAC-SHA256 sessions |
| Payments | Razorpay (server-side signature verification) |
| Build | Nx + pnpm |
| CI/CD | GitHub Actions |

## License

Licensed under **AGPL-3.0**. See [`LICENSE`](./LICENSE) and [`LICENSES.md`](./LICENSES.md). End-user/hosted-service notes: [`EULA.md`](./EULA.md).
