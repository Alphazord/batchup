// Production defaults — works without any env var injection.
// For local dev, override via .env.local (NEXT_PUBLIC_* vars are inlined at build time).
export const ENV = {
  serverUrl: process.env.NEXT_PUBLIC_SERVER_URL || "https://api.batchup.fun",
} as const;
