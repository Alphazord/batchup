import type { initDbConnect } from "./db";

export type Bindings = Env & {
  DB: D1Database;
  CHAT_ROOM: DurableObjectNamespace;
  AUTH_RATE_LIMITER: RateLimit;
  SESSION_RATE_LIMITER: RateLimit;
  CHAT_RATE_LIMITER: RateLimit;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ALLOWED_ORIGINS: string;
  WEB_APP_URL: string;
  SESSION_SECRET: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  SHARD_CONFIGS: string;
  TOTAL_SHARDS: string;
  SHARD_CALLBACK_API_KEY: string;
  ADMIN_API_KEY: string;
};
export type Variables = { db: ReturnType<typeof initDbConnect> };
