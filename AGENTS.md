<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Type Checking

After making changes, always verify types pass before proceeding:

```bash
# From the workspace root (/home/adnan/Documents/organizations/alphazord/code/batchup)

# Rebuild shared types (if @repo/types was changed)
npx tsc --project packages/types/tsconfig.json

# Typecheck apps
npx tsc --noEmit --project apps/web/tsconfig.json
npx tsc --noEmit --project apps/server/tsconfig.json
npx tsc --noEmit --project apps/admin/tsconfig.json
npx tsc --noEmit --project apps/sharded-workers/tsconfig.json
```

Note: root `pnpm typecheck` runs `nx run-many -t typecheck` and currently does **not** include `@repo/web` (no typecheck target). Prefer the explicit `tsc` commands above for full coverage.

## Workspace facts

- Product: **BatchUp** (Alphazord) — AGPL-3.0
- Apps: `web`, `admin`, `server` (Account 1), `sharded-workers` (×7)
- Packages: `@repo/auth`, `@repo/http`, `@repo/payments`, `@repo/products`, `@repo/types`, `@repo/api-endpoints`
- No root `dev` / `build` / `db:*` scripts — use `pnpm --filter <pkg> …`
- Open bugs: `fixes/FINDINGS.md`
