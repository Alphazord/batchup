import type { initDbConnect } from "./db";

export type Bindings = {
  DB: D1Database;
  CHAT_ROOM: DurableObjectNamespace;
  WS_RATE_LIMITER: RateLimit;
  SHARD_ID: string;
  SHARD_NAME: string;
  TOTAL_SHARDS: string;
  HMAC_SECRET: string;
  ACCOUNT1_CALLBACK_URL: string;
  ACCOUNT1_CALLBACK_API_KEY: string;
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_TOKEN: string;
  DAILY_DO_BUDGET: string;
  WARN_THRESHOLD: string;
  DEGRADE_THRESHOLD: string;
};

export type Variables = { db: ReturnType<typeof initDbConnect> };
