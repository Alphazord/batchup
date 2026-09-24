import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyBearerToken } from "./lib/crypto";
import { checkUpstashRateLimit } from "./lib/upstash";
import { CircuitBreaker } from "./lib/circuit-breaker";
import { ChatRoom } from "./do/ChatRoom";
import { initDbConnect } from "./db";
import { conversationMembers, conversations, messages } from "./db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { createHealthRoutes } from "./routes/health";
import { validateEnv } from "./env";
import { logInfo, logWarn, logError } from "./lib/logger";
import type { Bindings, Variables } from "./types";

export { ChatRoom };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const circuitBreaker = new CircuitBreaker();

let envValidated = false;

// CORS — allow Account 1 origin
app.use("/*", async (c, next) => {
  const allowedOrigins = [
    "https://batchup.fun",
    "https://www.batchup.fun",
  ];
  return cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "Upgrade"],
  })(c, next);
});

// Env validation middleware
app.use("/*", async (c, next) => {
  if (!envValidated) {
    const result = validateEnv(c.env as unknown as Record<string, unknown>);
    if (!result.ok) {
      logError("Shard env validation failed", undefined, { missing: result.missing });
      return c.json({ error: "Shard misconfigured", missing: result.missing }, 500);
    }
    envValidated = true;
    logInfo("Shard initialized", { shardId: c.env.SHARD_ID });
  }
  c.set("db", initDbConnect(c.env.DB));
  await next();
});

// Health check (no auth required)
app.route("/", createHealthRoutes(circuitBreaker));

// ─── HTTP Message Proxy (for Account 1 to fetch messages from shard DO) ───────
// Used by Account 1's POST /api/chat/conversations/:id/messages endpoint
// to load messages that live on this shard's DO.
app.post("/api/messages", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return c.json({ error: "Missing bearer token" }, 401);
  }

  const payload = await verifyBearerToken(token, c.env.HMAC_SECRET);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const conversationId = payload.conversation_id as string;
  if (!conversationId) {
    return c.json({ error: "Token missing conversation_id" }, 400);
  }

  const body = (await c.req.json()) as { cursor?: string; limit?: number };

  const doId = c.env.CHAT_ROOM.idFromName(conversationId);
  const stub = c.env.CHAT_ROOM.get(doId);
  const resp = await stub.fetch("http://do/messages", {
    method: "POST",
    headers: { "x-do-internal": "true" },
    body: JSON.stringify({ cursor: body.cursor, limit: body.limit }),
  });

  const data = (await resp.json()) as { messages: unknown[] };
  return c.json({ messages: data.messages });
});

// WebSocket upgrade endpoint
app.get("/ws/:conversationId", async (c) => {
  const conversationId = c.req.param("conversationId");
  const token = c.req.query("token");

  if (!token) {
    return c.json({ error: "Missing token" }, 401);
  }

  // 1. Verify HMAC-signed bearer token (stateless, no DB round-trip)
  const payload = await verifyBearerToken(token, c.env.HMAC_SECRET);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // 2. Validate conversation ID matches token
  if (payload.conversation_id !== conversationId) {
    return c.json({ error: "Token does not match conversation" }, 403);
  }

  // 3. Check circuit breaker
  const health = circuitBreaker.check(c.env);
  if (health === "degrade") {
    logWarn("Circuit breaker degraded — blocking new connection", { shardId: c.env.SHARD_ID });
    return c.json({ error: "Service temporarily at capacity", retryAfter: 60 }, 503);
  }

  // 4. Check cross-shard rate limit via Upstash
  const userId = payload.user_id as string;
  let allowed = true;
  try {
    allowed = await checkUpstashRateLimit(
      c.env.UPSTASH_REDIS_URL,
      c.env.UPSTASH_REDIS_TOKEN,
      userId,
      (payload.rate_limit_per_minute as number) ?? 40,
    );
  } catch (err) {
    // Redis failure: fail open (allow connection)
    console.error("Redis rate limit check failed, allowing connection:", err);
  }
  if (!allowed) {
    return c.json({
      error: "Rate limit exceeded",
      retryAfter: 60,
    }, 429);
  }

  // 5. Get or create DO for this conversation
  const doId = c.env.CHAT_ROOM.idFromName(conversationId);
  const stub = c.env.CHAT_ROOM.get(doId);

  // 6. Lazy D1 initialization — create conversation + member if first user on this shard
  const db = c.var.db;

  let membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .get();

  if (!membership) {
    const existingConv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!existingConv) {
      const tierLimits: Record<string, { perSecond: number; perMinute: number }> = {
        relaxed: { perSecond: 10, perMinute: 60 },
        normal: { perSecond: 3, perMinute: 40 },
        moderate: { perSecond: 2, perMinute: 20 },
        strict: { perSecond: 1, perMinute: 10 },
      };
      const tier = (payload.rate_limit_tier as string) || "normal";
      const limits = tierLimits[tier] ?? tierLimits.normal;

      await db.insert(conversations).values({
        id: conversationId,
        type: (payload.conversation_type as string) || "direct",
        name: (payload.conversation_name as string) || null,
        description: null,
        createdBy: userId,
        memberCount: 1,
        rateLimitTier: tier,
        rateLimitPerSecond: limits.perSecond,
        rateLimitPerMinute: limits.perMinute,
      }).onConflictDoNothing().run();
    }

    await db.insert(conversationMembers).values({
      conversationId,
      userId,
      role: (payload.role as string) || "member",
      joinedAt: new Date().toISOString(),
      lastReadAt: new Date().toISOString(),
      unreadCount: 0,
    }).onConflictDoNothing().run();

    membership = await db
      .select()
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
        ),
      )
      .get();
  }

  // Always call init-member on the DO — ensures DO SQLite members table is populated
  // even if a previous init-member call failed. The DO handler is idempotent (INSERT OR IGNORE).
  if (membership) {
    try {
      await stub.fetch("http://do/init-member", {
        method: "POST",
        headers: { "x-do-internal": "true", "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role: membership.role,
        }),
      });
      circuitBreaker.incrementDoRequest();
    } catch (err) {
      logError("Failed to init-member in DO", undefined, { conversationId, userId, error: String(err) });
    }
  }

  if (!membership) {
    return c.json({ error: "Failed to initialize membership" }, 500);
  }

  // 7. Forward WebSocket upgrade to DO with user info headers
  const headers = new Headers(c.req.raw.headers);
  headers.set("X-User-Id", userId);
  headers.set("X-User-Name", (payload.name as string) || "Unknown");
  headers.set("X-User-Picture", (payload.picture as string) || "");
  headers.set("X-Member-Role", membership.role);
  headers.set("X-Rate-Limit-Tier", (payload.rate_limit_tier as string) || "normal");

  const doRequest = new Request(c.req.raw.url, {
    method: c.req.raw.method,
    headers,
    body: c.req.raw.body,
    redirect: "manual",
  });

  // Increment circuit breaker counter for this DO request
  const doResponse = stub.fetch(doRequest);
  circuitBreaker.incrementDoRequest();
  return doResponse;
});

// ─── Admin Search Endpoint (HMAC-authenticated, Account 1 only) ─────────────
app.post("/api/admin/search", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return c.json({ error: "Missing bearer token" }, 401);
  }

  const payload = await verifyBearerToken(token, c.env.HMAC_SECRET);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  if (payload.user_id !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const body = (await c.req.json()) as {
    query?: string;
    senderId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  };

  const db = c.var.db;
  const limit = Math.min(200, Math.max(1, body.limit || 50));
  const offset = Math.max(0, body.offset || 0);

  const conditions = [];
  if (body.query) {
    conditions.push(sql`${messages.content} LIKE ${"%" + body.query + "%"}`);
  }
  if (body.senderId) {
    conditions.push(sql`${messages.senderId} = ${body.senderId}`);
  }
  if (body.from) {
    conditions.push(sql`${messages.createdAt} >= ${body.from}`);
  }
  if (body.to) {
    conditions.push(sql`${messages.createdAt} <= ${body.to}`);
  }

  const where =
    conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

  const [totalResult] = await db
    .select({ value: count() })
    .from(messages)
    .where(where);

  const msgs = await db.all(sql`
    SELECT m.*, u.name as sender_name, u.picture as sender_picture
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    ${where ? sql`WHERE ${where}` : sql``}
    ORDER BY m.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return c.json({
    messages: msgs,
    total: totalResult?.value ?? 0,
    shardId: Number(c.env.SHARD_ID),
  });
});

export default app;