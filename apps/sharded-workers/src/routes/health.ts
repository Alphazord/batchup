import { Hono } from "hono";
import { CircuitBreaker } from "../lib/circuit-breaker";
import { upstashCommand } from "../lib/upstash";
import type { Bindings, Variables } from "../types";

export function createHealthRoutes(circuitBreaker: CircuitBreaker) {
  const healthRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  healthRoutes.get("/health", async (c) => {
    const d1Check: { status: string; latency?: number } = { status: "not_checked" };
    const redisCheck: { status: string; latency?: number } = { status: "not_checked" };

    // 1. Check D1
    try {
      const start = Date.now();
      await c.env.DB.prepare("SELECT 1").first();
      d1Check.status = "connected";
      d1Check.latency = Date.now() - start;
    } catch {
      d1Check.status = "unreachable";
    }

    // 2. Check Redis (Upstash PING)
    try {
      const start = Date.now();
      await upstashCommand(c.env.UPSTASH_REDIS_URL, c.env.UPSTASH_REDIS_TOKEN, "PING");
      redisCheck.status = "connected";
      redisCheck.latency = Date.now() - start;
    } catch {
      redisCheck.status = "unreachable";
    }

    // 3. Overall status
    const degraded =
      d1Check.status !== "connected" || redisCheck.status !== "connected";

    return c.json(
      {
        status: degraded ? "degraded" : "ok",
        shardId: c.env.SHARD_ID,
        shardName: c.env.SHARD_NAME,
        d1: d1Check,
        redis: redisCheck,
        circuitBreaker: circuitBreaker.getStatus(),
      },
      degraded ? 503 : 200,
    );
  });

  return healthRoutes;
}
