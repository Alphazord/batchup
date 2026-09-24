# Web App (Next.js frontend)

Consumer UI for BatchUp: marketing pages + authenticated chat.

## Stack

Next.js 16, React 19, Tailwind CSS v4, `react-virtuoso`. Deployed to **Cloudflare Workers** via `@opennextjs/cloudflare` (`opennextjs-cloudflare build && deploy`).

## Commands

```bash
cd apps/web
pnpm dev      # next dev → http://localhost:3000
pnpm build
pnpm deploy   # OpenNext → Cloudflare Workers
pnpm cf-typegen
pnpm lint
```

From repo root: `pnpm --filter @repo/web dev` / `pnpm --filter @repo/web build`.

There is no root `pnpm dev` / `pnpm build` script.

## Structure (abridged — key paths)

```
apps/web/
├── middleware.ts              # redirects /chat and /dashboard if session cookie missing
├── next.config.ts             # CSP + security headers, OpenNext dev
├── public/_headers            # CF static headers (no CSP — known divergence)
└── src/
    ├── app/
    │   ├── page.tsx           # landing (redirects authed users to /chat)
    │   ├── chat/              # chat UI lives in layout.tsx; page.tsx returns null
    │   ├── dashboard/         # account/security overview
    │   └── about|contact|privacy|security|terms/
    ├── components/
    │   ├── chat/*             # sidebar, message list, modals, rate-limit settings, etc.
    │   ├── landing-page.tsx, footer.tsx, google-button.tsx, ...
    │   └── ui/*               # button, input, toast, ...
    ├── contexts/
    │   ├── auth-context.tsx   # session fetch, login redirect, logout
    │   └── chat-context.tsx   # conversations, WS, messages, presence, typing
    ├── config/
    │   ├── branding.ts        # product name/url constants
    │   └── env.ts             # ENV.serverUrl from NEXT_PUBLIC_SERVER_URL
    ├── lib/api.ts             # apiFetch (credentials: include, timeout, retry)
    └── types.ts
```

Notable present but **unmounted/dead**: `components/razorpay-button.tsx`, `components/signup-modal.tsx` (no imports).

## API access

- Base URL: `NEXT_PUBLIC_SERVER_URL` (only public API env var the code reads)
  - Runtime default in `src/config/env.ts`: `https://api.batchup.fun`
  - Default in `next.config.ts` (CSP): `http://localhost:8787`
  - **Always set the variable in real builds** — mismatched defaults break CSP or API calls
- `apiFetch`: `credentials: "include"`, 10s timeout, retries only on network/abort errors
- Endpoint paths mostly from `@repo/api-endpoints`; message load/read paths are hardcoded in `chat-context.tsx`

There is **no** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, or `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in code.

## Auth (client)

- Login: full-page redirect to `{serverUrl}/auth/google`
- Session: httpOnly cookie only — client never handles the token
- `useAuth` caches user in module memory (5 min TTL); cleared on logout
- `middleware.ts` checks **cookie presence only** for `/chat` and `/dashboard` (real enforcement is API 401 + client redirects); redirect target is always `/`
- Failed OAuth errors arrive as `?auth_error=` on `/` — **the app never reads this query param** (dead channel)

## Chat & WebSocket

1. REST for conversations/messages metadata via `apiFetch`
2. WS: `GET /api/chat/ws-token?conversationId=` → `{ token, shardUrl }`
3. Build `wss://{shardHost}/ws/{id}?token=…` (or Account 1 path when no shard)
4. Reconnect: exponential backoff, visibility/online handlers, 30s ping
5. Optimistic sends with `crypto.randomUUID()` nonce
6. Message render: plain React text (no `dangerouslySetInnerHTML`)
7. **Known:** `loadMessages` catch returns `[]` — failures look like an empty room (masks history bugs)

## Styling / CSP

- Tailwind v4; Google Fonts + Fontshare stylesheet link in layout
- CSP in `next.config.ts` includes Razorpay hosts for checkout (checkout currently unused)
- Known: Fontshare host may be missing from `style-src`; `script-src` allows `'unsafe-inline'`

## Env examples

- `apps/web/.env.local.example` — real: `NEXT_PUBLIC_SERVER_URL`; residue: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_SITE_URL` (unused in code; SITE_URL also injected by CI)
