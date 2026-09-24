import { Hono } from "hono";
import { desc, eq, sql, count, sum } from "drizzle-orm";
import { parseShardConfigs, assignShard, getShardUrl } from "../lib/shard-router";
import { signBearerToken } from "../lib/crypto";
import { logError } from "../lib/logger";
import {
  users,
  conversations,
  messages,
  orders,
} from "../db/schema";
import type { Bindings, Variables } from "../types";

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Overview Stats ──────────────────────────────────────────────────────────
adminRoutes.get("/stats", async (c) => {
  const db = c.var.db;

  const [userCount] = await db.select({ value: count() }).from(users);
  const [dmCount] = await db
    .select({ value: count() })
    .from(conversations)
    .where(eq(conversations.type, "dm"));
  const [groupCount] = await db
    .select({ value: count() })
    .from(conversations)
    .where(eq(conversations.type, "group"));
  const [messageCount] = await db.select({ value: count() }).from(messages);
  const [paidOrderCount] = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.status, "paid"));
  const [totalOrderCount] = await db.select({ value: count() }).from(orders);
  const [revenue] = await db
    .select({ value: sum(orders.amount) })
    .from(orders)
    .where(eq(orders.status, "paid"));

  const [activeSessions] = await db
    .select({ value: count() })
    .from(
      sql`(SELECT id FROM sessions WHERE expires_at > ${Math.floor(Date.now() / 1000)})`,
    );

  return c.json({
    totalUsers: userCount?.value ?? 0,
    totalConversations: (dmCount?.value ?? 0) + (groupCount?.value ?? 0),
    dmCount: dmCount?.value ?? 0,
    groupCount: groupCount?.value ?? 0,
    totalMessages: messageCount?.value ?? 0,
    totalOrders: totalOrderCount?.value ?? 0,
    paidOrders: paidOrderCount?.value ?? 0,
    totalRevenue: revenue?.value ?? 0,
    activeSessions: activeSessions?.value ?? 0,
  });
});

// ─── Timeline (30-day daily counts) ─────────────────────────────────────────
adminRoutes.get("/stats/timeline", async (c) => {
  const db = c.var.db;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const userTimeline = await db.all(
    sql`SELECT date(created_at) as date, COUNT(*) as count FROM users WHERE created_at >= ${thirtyDaysAgo} GROUP BY date(created_at) ORDER BY date ASC`,
  );

  const orderTimeline = await db.all(
    sql`SELECT date(created_at) as date, COUNT(*) as count FROM orders WHERE created_at >= ${thirtyDaysAgo} GROUP BY date(created_at) ORDER BY date ASC`,
  );

  const revenueTimeline = await db.all(
    sql`SELECT date(created_at) as date, SUM(amount) as total FROM orders WHERE status = 'paid' AND created_at >= ${thirtyDaysAgo} GROUP BY date(created_at) ORDER BY date ASC`,
  );

  return c.json({
    users: userTimeline,
    orders: orderTimeline,
    revenue: revenueTimeline,
  });
});

// ─── Users List ──────────────────────────────────────────────────────────────
adminRoutes.get("/users", async (c) => {
  const db = c.var.db;
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50));
  const search = c.req.query("search") || "";
  const offset = (page - 1) * limit;

  let whereClause = undefined;
  if (search) {
    whereClause = sql`${users.name} LIKE ${"%" + search + "%"} OR ${users.email} LIKE ${"%" + search + "%"}`;
  }

  const [totalResult] = await db
    .select({ value: count() })
    .from(users)
    .where(whereClause);

  const userList = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      picture: users.picture,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    users: userList,
    total: totalResult?.value ?? 0,
    page,
    limit,
  });
});

// ─── User Detail ─────────────────────────────────────────────────────────────
adminRoutes.get("/users/:id", async (c) => {
  const db = c.var.db;
  const userId = c.req.param("id");

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const userConversations = await db.all(sql`
    SELECT c.id, c.type, c.name, c.member_count, c.last_message_at, c.created_at,
           cm.role, cm.joined_at, cm.unread_count
    FROM conversations c
    INNER JOIN conversation_members cm ON c.id = cm.conversation_id
    WHERE cm.user_id = ${userId}
    ORDER BY c.last_message_at DESC NULLS LAST
  `);

  return c.json({ user, conversations: userConversations });
});

// ─── Conversations List ──────────────────────────────────────────────────────
adminRoutes.get("/conversations", async (c) => {
  const db = c.var.db;
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50));
  const type = c.req.query("type") || "";
  const shard = c.req.query("shard") || "";
  const search = c.req.query("search") || "";
  const offset = (page - 1) * limit;

  const conditions = [];
  if (type === "dm" || type === "group") {
    conditions.push(sql`${conversations.type} = ${type}`);
  }
  if (shard) {
    conditions.push(sql`${conversations.shardId} = ${Number(shard)}`);
  }
  if (search) {
    conditions.push(sql`(${conversations.name} LIKE ${"%" + search + "%"} OR ${conversations.id} LIKE ${"%" + search + "%"})`);
  }

  const whereClause =
    conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

  const [totalResult] = await db
    .select({ value: count() })
    .from(conversations)
    .where(whereClause);

  const convList = await db
    .select()
    .from(conversations)
    .where(whereClause)
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    conversations: convList,
    total: totalResult?.value ?? 0,
    page,
    limit,
  });
});

// ─── Conversation Detail ─────────────────────────────────────────────────────
adminRoutes.get("/conversations/:id", async (c) => {
  const db = c.var.db;
  const conversationId = c.req.param("id");

  const conv = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const members = await db.all(sql`
    SELECT cm.*, u.name, u.email, u.picture
    FROM conversation_members cm
    LEFT JOIN users u ON cm.user_id = u.id
    WHERE cm.conversation_id = ${conversationId}
  `);

  return c.json({ conversation: conv, members });
});

// ─── Message Search (fans out to shards) ─────────────────────────────────────
adminRoutes.get("/messages", async (c) => {
  const db = c.var.db;
  const query = c.req.query("q") || "";
  const conversationId = c.req.query("conversationId") || "";
  const senderId = c.req.query("senderId") || "";
  const from = c.req.query("from") || "";
  const to = c.req.query("to") || "";
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50));
  const offset = (page - 1) * limit;

  if (!query && !conversationId && !senderId) {
    return c.json({ error: "Provide at least one of q, conversationId, or senderId" }, 400);
  }

  // If conversationId specified, route to the correct shard
  if (conversationId) {
    // Non-sharded conversations (shardId = 0) — query Account 1 D1 directly
    const totalShards = parseInt(c.env.TOTAL_SHARDS) || 8;
    const shardConfigs = parseShardConfigs(c.env.SHARD_CONFIGS);
    const correctShardId = assignShard(conversationId, totalShards);

    const conv = await db
      .select({ shardId: conversations.shardId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conv) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    // Non-sharded conversation (shardId = 0) — query Account 1 D1 directly
    if (conv.shardId === 0) {
      const conditions = [sql`${messages.conversationId} = ${conversationId}`];
      if (query) conditions.push(sql`${messages.content} LIKE ${"%" + query + "%"}`);
      if (senderId) conditions.push(sql`${messages.senderId} = ${senderId}`);
      if (from) conditions.push(sql`${messages.createdAt} >= ${from}`);
      if (to) conditions.push(sql`${messages.createdAt} <= ${to}`);

      const where = sql`${sql.join(conditions, sql` AND `)}`;

      const [totalResult] = await db
        .select({ value: count() })
        .from(messages)
        .where(where);

      const msgs = await db.all(sql`
        SELECT m.*, u.name as sender_name, u.picture as sender_picture
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE ${where}
        ORDER BY m.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return c.json({
        messages: msgs,
        total: totalResult?.value ?? 0,
        page,
        limit,
        source: "account1",
      });
    }

    // Sharded conversation — fan out to the correct shard (recomputed from conversationId)
    const shardUrl = getShardUrl(correctShardId, shardConfigs);

    if (!shardUrl) {
      return c.json({ error: "Shard URL not configured for this conversation" }, 500);
    }

    try {
      const adminToken = await signBearerToken(
        { user_id: "admin", exp: Math.floor(Date.now() / 1000) + 300 },
        c.env.SESSION_SECRET,
      );
      const resp = await fetch(`${shardUrl}/api/admin/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ query, senderId, from, to, limit, offset }),
      });

      if (!resp.ok) {
        return c.json({ error: "Shard search failed" }, 502);
      }

      const data = (await resp.json()) as { messages: unknown[]; total: number };
      return c.json({
        messages: data.messages,
        total: data.total,
        page,
        limit,
        source: "shard",
        shardId: correctShardId,
      });
    } catch (err) {
      logError("Shard message search failed", err, { conversationId, shardId: correctShardId });
      return c.json({ error: "Shard unreachable" }, 502);
    }
  }

  // Global search — fan out to all shards + Account 1 D1
  const shardConfigs = parseShardConfigs(c.env.SHARD_CONFIGS);
  const activeShards = shardConfigs.filter((s) => s.id > 0);

  // Search Account 1 D1 (non-sharded conversations)
  const acct1Conditions = [sql`${messages.conversationId} IN (SELECT id FROM conversations WHERE shard_id = 0)`];
  if (query) acct1Conditions.push(sql`${messages.content} LIKE ${"%" + query + "%"}`);
  if (senderId) acct1Conditions.push(sql`${messages.senderId} = ${senderId}`);
  if (from) acct1Conditions.push(sql`${messages.createdAt} >= ${from}`);
  if (to) acct1Conditions.push(sql`${messages.createdAt} <= ${to}`);

  const acct1Where = sql`${sql.join(acct1Conditions, sql` AND `)}`;

  const acct1Messages = await db.all(sql`
    SELECT m.*, u.name as sender_name, u.picture as sender_picture
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE ${acct1Where}
    ORDER BY m.created_at DESC
    LIMIT 200
  `);

  // Fan out to all shards in parallel
  const adminToken = await signBearerToken(
    { user_id: "admin", exp: Math.floor(Date.now() / 1000) + 300 },
    c.env.SESSION_SECRET,
  );

  const shardResults = await Promise.allSettled(
    activeShards.map(async (shard) => {
      const resp = await fetch(`${shard.url}/api/admin/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ query, senderId, from, to, limit: 200, offset: 0 }),
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        throw new Error(`Shard ${shard.id} returned ${resp.status}`);
      }

      return (await resp.json()) as { messages: unknown[]; total: number; shardId: number };
    }),
  );

  // Merge results
  interface MergedMessage { createdAt: string; [key: string]: unknown }
  const allMessages: MergedMessage[] = [...(acct1Messages as MergedMessage[])];
  const errors: { shardId: number; error: string }[] = [];

  for (const result of shardResults) {
    if (result.status === "fulfilled") {
      allMessages.push(...(result.value.messages as MergedMessage[]));
    } else {
      errors.push({ shardId: 0, error: result.reason?.message || "Unknown error" });
    }
  }

  // Sort by created_at desc and apply pagination
  allMessages.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const total = allMessages.length;
  const paginatedMessages = allMessages.slice(offset, offset + limit);

  return c.json({
    messages: paginatedMessages,
    total,
    page,
    limit,
    source: "global",
    errors: errors.length > 0 ? errors : undefined,
  });
});

// ─── Orders List ─────────────────────────────────────────────────────────────
adminRoutes.get("/orders", async (c) => {
  const db = c.var.db;
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50));
  const status = c.req.query("status") || "";
  const search = c.req.query("search") || "";
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) {
    conditions.push(sql`${orders.status} = ${status}`);
  }
  if (search) {
    conditions.push(
      sql`(${orders.productName} LIKE ${"%" + search + "%"} OR ${orders.customerName} LIKE ${"%" + search + "%"} OR ${orders.customerEmail} LIKE ${"%" + search + "%"})`,
    );
  }

  const whereClause =
    conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

  const [totalResult] = await db
    .select({ value: count() })
    .from(orders)
    .where(whereClause);

  const orderList = await db
    .select()
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    orders: orderList,
    total: totalResult?.value ?? 0,
    page,
    limit,
  });
});

// ─── Orders Stats ────────────────────────────────────────────────────────────
adminRoutes.get("/orders/stats", async (c) => {
  const db = c.var.db;

  const [revenue] = await db
    .select({ value: sum(orders.amount) })
    .from(orders)
    .where(eq(orders.status, "paid"));

  const [paidCount] = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.status, "paid"));

  const [pendingCount] = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.status, "pending"));

  const [failedCount] = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.status, "failed"));

  const byProduct = await db.all(sql`
    SELECT product_id, product_name, SUM(amount) as total_revenue, COUNT(*) as order_count
    FROM orders
    WHERE status = 'paid'
    GROUP BY product_id, product_name
    ORDER BY total_revenue DESC
  `);

  return c.json({
    totalRevenue: revenue?.value ?? 0,
    paidCount: paidCount?.value ?? 0,
    pendingCount: pendingCount?.value ?? 0,
    failedCount: failedCount?.value ?? 0,
    byProduct,
  });
});

// ─── Shard Health ────────────────────────────────────────────────────────────
adminRoutes.get("/shards", async (c) => {
  const db = c.var.db;
  const shardConfigs = parseShardConfigs(c.env.SHARD_CONFIGS);

  // Get conversation count per shard from Account 1 D1
  const shardConvCounts = await db.all(sql`
    SELECT shard_id, COUNT(*) as count FROM conversations GROUP BY shard_id
  `);

  const convCountMap = new Map<number, number>();
  for (const row of shardConvCounts) {
    const r = row as { shard_id: number; count: number };
    convCountMap.set(r.shard_id, r.count);
  }

  // Ping each shard for health data
  const shardResults = await Promise.allSettled(
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
            status: resp.ok ? "ok" : "degraded",
            latency: Date.now() - start,
            d1: data.d1,
            redis: data.redis,
            circuitBreaker: data.circuitBreaker,
            conversationCount: convCountMap.get(shard.id) ?? 0,
          };
        } catch {
          return {
            id: shard.id,
            name: shard.name,
            status: "unreachable",
            latency: Date.now() - start,
            conversationCount: convCountMap.get(shard.id) ?? 0,
          };
        }
      }),
  );

  const shards = shardResults.map((r) =>
    r.status === "fulfilled" ? r.value : { id: 0, name: "unknown", status: "error", latency: 0, conversationCount: 0 },
  );

  // Account 1's own conversation count (shard_id = 0)
  const acct1ConvCount = convCountMap.get(0) ?? 0;

  return c.json({ shards, acct1ConversationCount: acct1ConvCount });
});

// ─── System Health ───────────────────────────────────────────────────────────
adminRoutes.get("/system", async (c) => {
  const db = c.var.db;

  // D1 check
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

  // Session counts
  const now = Math.floor(Date.now() / 1000);
  const [activeSessions] = await db
    .select({ value: count() })
    .from(sql`(SELECT id FROM sessions WHERE expires_at > ${now})`);

  // Shard distribution
  const shardDist = await db.all(sql`
    SELECT shard_id, COUNT(*) as count FROM conversations GROUP BY shard_id ORDER BY shard_id
  `);

  return c.json({
    database: dbCheck,
    activeSessions: activeSessions?.value ?? 0,
    shardDistribution: shardDist,
  });
});
