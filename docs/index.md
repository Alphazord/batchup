# BatchUp Documentation

Real-time chat application built on Cloudflare Workers, Durable Objects, and Next.js.  
An [Alphazord](https://alphazord.space) product.

## Architecture

| Doc | Description |
|-----|-------------|
| [architecture.md](./architecture.md) | System overview, data flow, shard routing |
| [server.md](./server.md) | Account 1 Worker — auth, REST API, DO lifecycle |
| [web.md](./web.md) | Next.js 16 frontend — chat UI, WebSocket client |
| [shards.md](./shards.md) | 7 sharded Workers — Durable Objects, message broadcasting |
| [database.md](./database.md) | D1 schema, DO SQLite, migrations |
| [api.md](./api.md) | REST endpoint reference |
| [security.md](./security.md) | Security model, encryption, auth, known limitations |

## Operations

| Doc | Description |
|-----|-------------|
| [deployment.md](./deployment.md) | CI/CD, Cloudflare setup, environment config |
| [environment.md](./environment.md) | All environment variables reference |
| [setup.md](./setup.md) | Local development setup |

## Open findings

Tracked bugs and architectural issues: [../fixes/FINDINGS.md](../fixes/FINDINGS.md).

## Quick Start

```bash
# Install dependencies
pnpm install

# Start apps individually (no root dev script)
pnpm --filter @repo/server dev   # API → http://localhost:8787
pnpm --filter @repo/web dev      # Web → http://localhost:3000

# Type check
npx tsc --noEmit --project apps/server/tsconfig.json
npx tsc --noEmit --project apps/web/tsconfig.json
npx tsc --noEmit --project apps/admin/tsconfig.json
npx tsc --noEmit --project apps/sharded-workers/tsconfig.json
```

## Product

- **Name:** BatchUp
- **Operator:** Alphazord (Alphazord.space)
- **Domains:** batchup.fun / api.batchup.fun
- **Stack:** Hono + Cloudflare Workers + Durable Objects + D1 + Drizzle ORM + Next.js 16 + Tailwind v4
- **License:** AGPL-3.0 — see [../LICENSE](../LICENSE)
