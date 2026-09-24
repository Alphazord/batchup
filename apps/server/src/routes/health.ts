import { Hono } from "hono";
import { parseShardConfigs } from "../lib/shard-router";
import type { Bindings, Variables } from "../types";

export const healthRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

healthRoutes.get("/health", async (c) => {
  // 1. Check D1
  let dbCheck = { status: "missing", latency: 0 };
  if (c.env.DB) {
    try {
      const start = Date.now();
      await c.env.DB.prepare("SELECT 1").first();
      dbCheck = { status: "connected", latency: Date.now() - start };
    } catch {
      dbCheck = { status: "unreachable", latency: 0 };
    }
  }

  // 2. Ping all shards
  const shardConfigs = parseShardConfigs(c.env.SHARD_CONFIGS);
  const shardResults = await Promise.all(
    shardConfigs
      .filter((s) => s.id > 0)
      .map(async (shard) => {
        const start = Date.now();
        try {
          const resp = await fetch(`${shard.url}/health`, {
            signal: AbortSignal.timeout(5000),
          });
          const data = (await resp.json()) as Record<string, unknown>;
          return {
            id: shard.id,
            name: shard.name,
            url: shard.url,
            status: resp.ok ? "ok" : "degraded",
            latency: Date.now() - start,
            d1: data.d1,
            redis: data.redis,
            circuitBreaker: data.circuitBreaker,
          };
        } catch {
          return {
            id: shard.id,
            name: shard.name,
            url: shard.url,
            status: "unreachable",
            latency: Date.now() - start,
          };
        }
      }),
  );

  // 3. Overall status
  const allShardsOk = shardResults.every((s) => s.status === "ok");
  const status = dbCheck.status === "connected" && allShardsOk ? "ok" : "degraded";

  return c.json(
    { status, db: dbCheck, shards: shardResults },
    status === "ok" ? 200 : 503,
  );
});
