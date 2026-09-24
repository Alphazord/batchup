import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import { eq, and, sql, desc, ne } from "drizzle-orm";
import { users, conversations, conversationMembers, sessions, messages as messagesTable, messageReactions } from "../db/schema";
import { hashSession, signBearerToken } from "../lib/crypto";
import { logError } from "../lib/logger";
import { SESSION_TOKEN_LENGTH } from "../constants";
import { assignShard, getShardUrl, parseShardConfigs } from "../lib/shard-router";
import type { Bindings, Variables } from "../types";

export const chatRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Auth Helper ─────────────────────────────────────────────────────────────

async function getUserFromSession(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<{ id: string; email: string; name: string; picture: string | null } | null> {
  const sessionToken =
    c.req.header("Authorization")?.replace("Bearer ", "") || getCookie(c, "session");

  if (!sessionToken || sessionToken.length !== SESSION_TOKEN_LENGTH) return null;

  const sessionHash = await hashSession(sessionToken, c.env.SESSION_SECRET);
  const db = c.var.db;

  // Single JOIN query instead of two sequential queries (Fix 9)
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      picture: users.picture,
      sessionExpiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionHash))
    .get();

  if (!result || result.sessionExpiresAt < Math.floor(Date.now() / 1000)) return null;

  return { id: result.id, email: result.email, name: result.name, picture: result.picture };
}

// ─── User Search ─────────────────────────────────────────────────────────────

chatRoutes.get("/users/search", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const query = c.req.query("q");
  if (!query || query.length < 1) {
    return c.json({ users: [] });
  }
  if (query.length > 100) {
    return c.json({ users: [] });
  }

  const db = c.var.db;
  const searchTerm = `%${query.toLowerCase()}%`;

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      picture: users.picture,
    })
    .from(users)
    .where(
      and(
        sql`(LOWER(${users.name}) LIKE ${searchTerm} OR LOWER(${users.email}) LIKE ${searchTerm})`,
        sql`${users.id} != ${user.id}`,
      ),
    )
    .limit(20)
    .all();

  return c.json({ users: results });
});

// ─── Conversations ───────────────────────────────────────────────────────────

chatRoutes.get("/conversations", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = c.var.db;

  try {
    const results = await db
      .select({
        id: conversations.id,
        type: conversations.type,
        name: conversations.name,
        description: conversations.description,
        createdBy: conversations.createdBy,
        memberCount: conversations.memberCount,
        lastMessageAt: conversations.lastMessageAt,
        lastMessagePreview: conversations.lastMessagePreview,
        createdAt: conversations.createdAt,
        role: conversationMembers.role,
        joinedAt: conversationMembers.joinedAt,
        lastReadAt: conversationMembers.lastReadAt,
        unreadCount: conversationMembers.unreadCount,
      })
      .from(conversations)
      .innerJoin(
        conversationMembers,
        eq(conversations.id, conversationMembers.conversationId),
      )
      .where(eq(conversationMembers.userId, user.id))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .all();

    // For DMs, fetch the other member's info
    const dmIds = results.filter((r) => r.type === "dm").map((r) => r.id);
    const dmOtherMembers: Record<string, { name: string; picture: string | null; userId: string }> = {};

    if (dmIds.length > 0) {
      const dmMembers = await db
        .select({
          conversationId: conversationMembers.conversationId,
          userId: conversationMembers.userId,
          name: users.name,
          picture: users.picture,
        })
        .from(conversationMembers)
        .innerJoin(users, eq(conversationMembers.userId, users.id))
        .where(
          and(
            sql`${conversationMembers.conversationId} IN ${dmIds}`,
            sql`${conversationMembers.userId} != ${user.id}`,
          ),
        )
        .all();

      for (const m of dmMembers) {
        dmOtherMembers[m.conversationId] = {
          name: m.name,
          picture: m.picture,
          userId: m.userId,
        };
      }
    }

    const enriched = results.map((r) => ({
      ...r,
      otherUserName: dmOtherMembers[r.id]?.name ?? null,
      otherUserPicture: dmOtherMembers[r.id]?.picture ?? null,
      otherUserId: dmOtherMembers[r.id]?.userId ?? null,
    }));

    return c.json({ conversations: enriched });
  } catch (err) {
    logError("Failed to fetch conversations", err);
    return c.json({ error: "Failed to fetch conversations" }, 500);
  }
});

chatRoutes.post("/conversations", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = (await c.req.json()) as {
    type: "dm" | "group";
    name?: string;
    description?: string;
    memberIds?: string[];
  };

  if (!body.type || !["dm", "group"].includes(body.type)) {
    return c.json({ error: "Invalid conversation type" }, 400);
  }

  if (body.type === "dm" && (!body.memberIds || body.memberIds.length !== 1)) {
    return c.json({ error: "DM requires exactly one other member" }, 400);
  }

  if (body.type === "group" && (!body.name || body.name.trim().length === 0)) {
    return c.json({ error: "Group requires a name" }, 400);
  }

  const db = c.var.db;
  let conversationId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Determine shard assignment
  const totalShards = parseInt(c.env.TOTAL_SHARDS) || 8;
  const shardConfigs = parseShardConfigs(c.env.SHARD_CONFIGS);
  let shardId = assignShard(conversationId, totalShards);
  let shardUrl = getShardUrl(shardId, shardConfigs);

  // Auto-default >500 member groups to strict rate limit tier
  const memberCount = (body.memberIds?.length ?? 0) + 1; // +1 for creator
  const rateLimitTier = body.type === "group" && memberCount > 500 ? "strict" : "normal";

  // For DMs, check if conversation already exists
  if (body.type === "dm" && body.memberIds?.[0]) {
    const otherUserId = body.memberIds[0];

    // Use deterministic ID for DMs to prevent TOCTOU race on duplicate check
    const sortedIds = [user.id, otherUserId].sort();
    conversationId = `dm-${sortedIds[0]}-${sortedIds[1]}`;

    // Recompute shard assignment for the deterministic DM ID
    shardId = assignShard(conversationId, totalShards);
    shardUrl = getShardUrl(shardId, shardConfigs);

    const existingDm = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (existingDm) {
      return c.json({ conversationId: existingDm.id, existing: true });
    }
  }

  // Validate member count
  const MAX_GROUP_MEMBERS = 5000;
  const memberIds = (body.memberIds ?? []).filter((id: string) => id !== user.id);
  if (body.type === "group" && memberIds.length > MAX_GROUP_MEMBERS) {
    return c.json({ error: `Cannot add more than ${MAX_GROUP_MEMBERS} members` }, 400);
  }

  // Create conversation + add ALL members atomically
  const memberInserts = memberIds.length > 0
    ? memberIds.map((memberId: string) => ({
        conversationId,
        userId: memberId,
        role: "member" as const,
        joinedAt: now,
      }))
    : [];

  await db.batch([
    db.insert(conversations).values({
      id: conversationId,
      type: body.type,
      name: body.name?.trim() || null,
      description: body.description?.trim() || null,
      createdBy: user.id,
      memberCount: 1 + memberInserts.length,
      shardId,
      shardUrl,
      rateLimitTier,
      createdAt: now,
    }),
    db.insert(conversationMembers).values({
      conversationId,
      userId: user.id,
      role: "owner",
      joinedAt: now,
    }),
    ...(memberInserts.length > 0
      ? [db.insert(conversationMembers).values(memberInserts)]
      : []),
  ]);

  // Reconcile memberCount with actual row count
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId))
    .get();
  await db
    .update(conversations)
    .set({ memberCount: countResult?.count ?? 1 })
    .where(eq(conversations.id, conversationId))
    .run();

  // Initialize all members in the DO (parallelized for performance)
  try {
    const doId = c.env.CHAT_ROOM.idFromName(conversationId);
    const stub = c.env.CHAT_ROOM.get(doId);

    // Build all init-member calls
    const initCalls: Promise<Response>[] = [];

    // Init creator
    initCalls.push(
      stub.fetch("http://do/init-member", {
        method: "POST",
        headers: { "x-do-internal": "true" },
        body: JSON.stringify({ userId: user.id, role: "owner" }),
      })
    );

    // Init other members in parallel
    if (memberIds.length > 0) {
      for (const memberId of memberIds) {
        initCalls.push(
          stub.fetch("http://do/init-member", {
            method: "POST",
            headers: { "x-do-internal": "true" },
            body: JSON.stringify({ userId: memberId, role: "member" }),
          })
        );
      }
    }

    // Execute all init calls in parallel
    const results = await Promise.allSettled(initCalls);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("init-member call failed:", result.reason);
      } else if (!result.value.ok) {
        console.error("init-member returned error:", result.value.status);
      }
    }

    // System message for group creation
    if (body.type === "group") {
      await stub.fetch("http://do/system-message", {
        method: "POST",
        headers: { "x-do-internal": "true" },
        body: JSON.stringify({ content: `${user.name} created the group ${body.name ?? ""}` }),
      });
    }
  } catch (err) {
    console.error("DO init-member call failed:", err);
  }

  return c.json({ conversationId, existing: false });
});

chatRoutes.get("/conversations/:id", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const db = c.var.db;

  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership) return c.json({ error: "Not a member" }, 403);

  const conversation = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conversation) return c.json({ error: "Not found" }, 404);

  return c.json({ conversation, role: membership.role });
});

chatRoutes.put("/conversations/:id", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const db = c.var.db;

  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Only the owner or admin can update group info" }, 403);
  }

  const body = (await c.req.json()) as { name?: string; description?: string };
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (trimmed.length === 0) return c.json({ error: "Name cannot be empty" }, 400);
    if (trimmed.length > 100) return c.json({ error: "Name too long" }, 400);
    updates.name = trimmed;
  }

  if (body.description !== undefined) {
    const trimmed = body.description.trim();
    if (trimmed.length > 500) return c.json({ error: "Description too long" }, 400);
    updates.description = trimmed || null;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No updates provided" }, 400);
  }

  await db.update(conversations).set(updates).where(eq(conversations.id, conversationId)).run();

  // Notify DO to broadcast group_updated event
  try {
    const doId = c.env.CHAT_ROOM.idFromName(conversationId);
    const stub = c.env.CHAT_ROOM.get(doId);
    await stub.fetch("http://do/update-group-info", {
      method: "POST",
      headers: { "x-do-internal": "true" },
      body: JSON.stringify({ conversationId, name: body.name, description: body.description }),
    });
  } catch { /* best effort */ }

  return c.json({ ok: true });
});

chatRoutes.post("/conversations/:id/read", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const db = c.var.db;

  // Verify membership
  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership) return c.json({ error: "Not a member" }, 403);

  const now = new Date().toISOString();

  await db
    .update(conversationMembers)
    .set({ lastReadAt: now })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .run();

  // Notify DO to clear pending unread updates
  try {
    const doId = c.env.CHAT_ROOM.idFromName(conversationId);
    const stub = c.env.CHAT_ROOM.get(doId);
    await stub.fetch("http://do/mark-read", {
      method: "POST",
      headers: { "x-do-internal": "true" },
      body: JSON.stringify({ userId: user.id }),
    });
  } catch { /* best effort */ }

  return c.json({ ok: true });
});

chatRoutes.delete("/conversations/:id", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const db = c.var.db;

  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership) return c.json({ error: "Not a member" }, 403);

  // Fetch conversation type
  const conv = await db
    .select({ type: conversations.type })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  // For DMs, either party can leave (deletes the conversation)
  // For groups, owner cannot leave
  if (membership.role === "owner" && conv?.type !== "dm") {
    return c.json({ error: "Owner cannot leave" }, 400);
  }

  await db
    .delete(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .run();

  // For DMs, delete the entire conversation when either party leaves
  if (conv?.type === "dm") {
    await db.delete(conversations).where(eq(conversations.id, conversationId)).run();
  } else {
    await db
      .update(conversations)
      .set({ memberCount: sql`${conversations.memberCount} - 1` })
      .where(eq(conversations.id, conversationId))
      .run();
  }

  // Remove from DO members table
  try {
    const doId = c.env.CHAT_ROOM.idFromName(conversationId);
    const stub = c.env.CHAT_ROOM.get(doId);
    await stub.fetch("http://do/remove-member", {
      method: "POST",
      headers: { "x-do-internal": "true" },
      body: JSON.stringify({ userId: user.id }),
    });
    await stub.fetch("http://do/system-message", {
      method: "POST",
      headers: { "x-do-internal": "true" },
      body: JSON.stringify({ content: `${user.name} left the group` }),
    });
  } catch { /* best effort */ }

  return c.json({ ok: true });
});

// ─── Profile ──────────────────────────────────────────────────────────────

chatRoutes.get("/profile/me", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = c.var.db;
  const profile = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      picture: users.picture,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  return c.json({ user: profile });
});

chatRoutes.put("/profile", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = (await c.req.json()) as { name?: string; username?: string };
  const db = c.var.db;

  if (!body.name || body.name.trim().length === 0) {
    return c.json({ error: "Name is required" }, 400);
  }
  if (body.name.trim().length > 100) {
    return c.json({ error: "Name too long" }, 400);
  }

  const updates: { name?: string; username?: string; updatedAt: string } = {
    name: body.name.trim(),
    updatedAt: new Date().toISOString(),
  };

  if (body.username !== undefined) {
    const newUsername = body.username.trim().toLowerCase();
    if (newUsername.length === 0) {
      return c.json({ error: "Username is required" }, 400);
    }
    if (newUsername.length > 24) {
      return c.json({ error: "Username too long (max 24 characters)" }, 400);
    }
    if (!/^[a-z][a-z0-9._]{0,23}$/.test(newUsername)) {
      return c.json({ error: "Username can only contain lowercase letters, numbers, dots, and underscores. Must start with a letter." }, 400);
    }
    // Check uniqueness
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, newUsername), ne(users.id, user.id)))
      .get();
    if (existing) {
      return c.json({ error: "Username is already taken" }, 409);
    }
    updates.username = newUsername;
  }

  await db
    .update(users)
    .set(updates)
    .where(eq(users.id, user.id))
    .run();

  return c.json({ ok: true });
});

// ─── Members ─────────────────────────────────────────────────────────────────

chatRoutes.get("/conversations/:id/members", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const db = c.var.db;

  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership) return c.json({ error: "Not a member" }, 403);

  const members = await db
    .selectDistinct({
      conversationId: conversationMembers.conversationId,
      userId: conversationMembers.userId,
      role: conversationMembers.role,
      joinedAt: conversationMembers.joinedAt,
      name: users.name,
      picture: users.picture,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(conversationMembers.userId, users.id))
    .where(eq(conversationMembers.conversationId, conversationId))
    .all();

  return c.json({ members });
});

chatRoutes.post("/conversations/:id/members", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const body = (await c.req.json()) as { userId: string };
  const db = c.var.db;

  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Not authorized" }, 403);
  }

  const existing = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, body.userId),
      ),
    )
    .get();

  if (existing) return c.json({ error: "Already a member" }, 400);

  await db.insert(conversationMembers).values({
    conversationId,
    userId: body.userId,
    role: "member",
  });

  await db
    .update(conversations)
    .set({ memberCount: sql`${conversations.memberCount} + 1` })
    .where(eq(conversations.id, conversationId))
    .run();

  // Send system message + init member in DO
  try {
    const targetUser = await db.select({ name: users.name }).from(users).where(eq(users.id, body.userId)).get();
    const doId = c.env.CHAT_ROOM.idFromName(conversationId);
    const stub = c.env.CHAT_ROOM.get(doId);
    await stub.fetch("http://do/init-member", {
      method: "POST",
      headers: { "x-do-internal": "true" },
      body: JSON.stringify({ userId: body.userId, role: "member" }),
    });
    await stub.fetch("http://do/system-message", {
      method: "POST",
      headers: { "x-do-internal": "true" },
      body: JSON.stringify({ content: `${user.name} invited ${targetUser?.name ?? "Someone"} to the group` }),
    });
  } catch { /* best effort */ }

  return c.json({ ok: true });
});

chatRoutes.delete("/conversations/:id/members/:userId", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const db = c.var.db;

  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Not authorized" }, 403);
  }

  if (targetUserId === membership.userId && membership.role === "owner") {
    return c.json({ error: "Cannot remove the owner" }, 400);
  }

  await db
    .delete(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, targetUserId),
      ),
    )
    .run();

  await db
    .update(conversations)
    .set({ memberCount: sql`${conversations.memberCount} - 1` })
    .where(eq(conversations.id, conversationId))
    .run();

  // Send system message + remove from DO members
  try {
    const targetUser = await db.select({ name: users.name }).from(users).where(eq(users.id, targetUserId)).get();
    const doId = c.env.CHAT_ROOM.idFromName(conversationId);
    const stub = c.env.CHAT_ROOM.get(doId);
    await stub.fetch("http://do/remove-member", {
      method: "POST",
      headers: { "x-do-internal": "true" },
      body: JSON.stringify({ userId: targetUserId }),
    });
    await stub.fetch("http://do/system-message", {
      method: "POST",
      headers: { "x-do-internal": "true" },
      body: JSON.stringify({ content: `${targetUser?.name ?? "Someone"} was removed from the group` }),
    });
  } catch { /* best effort */ }

  return c.json({ ok: true });
});

// ─── Messages ────────────────────────────────────────────────────────────────

chatRoutes.post("/conversations/:id/messages", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const db = c.var.db;

  // Verify membership (also confirms conversation exists)
  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership) return c.json({ error: "Not a member" }, 403);

  const body = (await c.req.json()) as { cursor?: string; limit?: number };
  const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);

  const shardConfigs = parseShardConfigs(c.env.SHARD_CONFIGS);
  // Recompute shard from conversationId — conv.shardId may be stale from old DM creation bug
  const totalShards = parseInt(c.env.TOTAL_SHARDS) || 8;
  const correctShardId = assignShard(conversationId, totalShards);
  const shardUrl = getShardUrl(correctShardId, shardConfigs);

  // If conversation is on a shard, fetch messages from the shard DO
  if (shardUrl) {
    try {
      // Sign a bearer token for the shard (stateless auth)
      const token = await signBearerToken(
        {
          user_id: user.id,
          conversation_id: conversationId,
          exp: Math.floor(Date.now() / 1000) + 30, // short-lived, read-only
        },
        c.env.SESSION_SECRET,
      );

      const shardHost = new URL(shardUrl).host;
      const protocol = new URL(shardUrl).protocol;
      const resp = await fetch(`${protocol}//${shardHost}/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cursor: body.cursor, limit }),
      });

      if (resp.ok) {
        const data = (await resp.json()) as { messages: unknown[] };
        return c.json({ messages: data.messages });
      }
      logError(`Shard message fetch failed with status ${resp.status}`, undefined, { conversationId, shardUrl });
    } catch (err) {
      logError("Shard message fetch failed, falling back to Account 1 DO", err, { conversationId, shardUrl });
    }
  }

  // Fallback: try D1 on Account 1 (for non-sharded conversations or D1 failures)
  try {
    const d1Messages = await db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, conversationId),
          body.cursor ? sql`${messagesTable.createdAt} < ${body.cursor}` : sql`1=1`,
        ),
      )
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit)
      .all();

    if (d1Messages.length > 0) {
      // Fetch reactions for all returned messages
      const messageIds = d1Messages.map((m) => m.id);
      const reactionsMap: Record<string, Record<string, string[]>> = {};

      if (messageIds.length > 0) {
        const reactionRows = await db
          .select()
          .from(messageReactions)
          .where(
            and(
              eq(messageReactions.conversationId, conversationId),
              sql`${messageReactions.messageId} IN ${messageIds}`,
            ),
          )
          .all();

        for (const row of reactionRows) {
          const msgId = row.messageId;
          const emoji = row.emoji;
          const uid = row.userId;
          if (!reactionsMap[msgId]) reactionsMap[msgId] = {};
          if (!reactionsMap[msgId][emoji]) reactionsMap[msgId][emoji] = [];
          reactionsMap[msgId][emoji].push(uid);
        }
      }

      // Convert to camelCase output format
      const enriched = d1Messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        type: m.type,
        replyToId: m.replyToId,
        replyCount: m.replyCount,
        deletedAt: m.deletedAt,
        deletedBy: m.deletedBy,
        editedAt: m.editedAt,
        createdAt: m.createdAt,
        reactions: reactionsMap[m.id] ?? {},
      }));

      return c.json({ messages: enriched });
    }
  } catch (err) {
    logError("D1 message query failed, falling back to Account 1 DO", err);
  }

  // Final fallback: Account 1's own DO (handles pre-migration conversations)
  const doId = c.env.CHAT_ROOM.idFromName(conversationId);
  const stub = c.env.CHAT_ROOM.get(doId);
  const resp = await stub.fetch("http://do/messages", {
    method: "POST",
    headers: { "x-do-internal": "true" },
    body: JSON.stringify({ cursor: body.cursor, limit }),
  });
  const data = (await resp.json()) as { messages: unknown[] };

  return c.json({ messages: data.messages });
});

// ─── WebSocket Token ────────────────────────────────────────────────────────

chatRoutes.get("/ws-token", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.query("conversationId");
  if (!conversationId) return c.json({ error: "Missing conversationId" }, 400);

  const db = c.var.db;

  // Look up conversation to get shard assignment and rate limit tier
  const conv = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conv) return c.json({ error: "Conversation not found" }, 404);

  // Verify membership
  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership) return c.json({ error: "Not a member" }, 403);

  // Get rate limit tier and numeric limits
  const rateLimitTier = conv.rateLimitTier ?? "normal";
  const tierLimits: Record<string, { perSecond: number; perMinute: number }> = {
    relaxed: { perSecond: 10, perMinute: 60 },
    normal: { perSecond: 3, perMinute: 40 },
    moderate: { perSecond: 2, perMinute: 20 },
    strict: { perSecond: 1, perMinute: 10 },
  };
  const limits = tierLimits[rateLimitTier] ?? tierLimits.normal;

  // Build shard URL — recompute from conversationId to handle existing rows with stale shardId
  const totalShards = parseInt(c.env.TOTAL_SHARDS) || 8;
  const shardConfigs = parseShardConfigs(c.env.SHARD_CONFIGS);
  const correctShardId = assignShard(conversationId, totalShards);
  const shardUrl = getShardUrl(correctShardId, shardConfigs);

  // Sign HMAC bearer token for shard auth
  const token = await signBearerToken(
    {
      user_id: user.id,
      name: user.name,
      picture: user.picture ?? "",
      conversation_id: conversationId,
      shard_id: correctShardId,
      role: membership.role,
      rate_limit_tier: rateLimitTier,
      rate_limit_per_second: limits.perSecond,
      rate_limit_per_minute: limits.perMinute,
      conversation_type: conv.type,
      conversation_name: conv.name,
      exp: Math.floor(Date.now() / 1000) + 300, // 5 min expiry
    },
    c.env.SESSION_SECRET,
  );

  return c.json({ token, shardUrl });
});

// ─── WebSocket Upgrade ───────────────────────────────────────────────────────

chatRoutes.get("/ws/:conversationId", async (c) => {
  const conversationId = c.req.param("conversationId");
  const db = c.var.db;

  // Accept auth from cookie OR ws_token query param
  let user: { id: string; email: string; name: string; picture: string | null } | null = null;

  const wsToken = c.req.query("token");
  if (wsToken && wsToken.length === 86) {
    // Validate ws_token
    const now = Math.floor(Date.now() / 1000);
    const sessionRow = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(
        and(
          eq(sessions.wsToken, wsToken),
          sql`${sessions.wsTokenExpiresAt} > ${now}`,
          sql`${sessions.expiresAt} > ${now}`,
        ),
      )
      .get();

    if (sessionRow) {
      // Look up user
      const u = await db
        .select({ id: users.id, email: users.email, name: users.name, picture: users.picture })
        .from(users)
        .where(eq(users.id, sessionRow.userId))
        .get();
      if (u) user = u;

      // Invalidate the ws token (single-use)
      await db
        .update(sessions)
        .set({ wsToken: null, wsTokenExpiresAt: null })
        .where(eq(sessions.wsToken, wsToken))
        .run();
    }
  }

  // Fallback to cookie auth
  if (!user) {
    user = await getUserFromSession(c);
  }

  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Verify membership
  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership) return c.json({ error: "Not a member" }, 403);

  // Fetch conversation info from D1
  const conv = await db
    .select({ rateLimitTier: conversations.rateLimitTier, shardId: conversations.shardId, shardUrl: conversations.shardUrl })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conv) return c.json({ error: "Conversation not found" }, 404);

  // Verify this conversation belongs to this shard — recompute from conversationId
  // (stored shardId may be stale from old DM creation bug)
  const totalShards = parseInt(c.env.TOTAL_SHARDS) || 8;
  const myShardId = assignShard(conversationId, totalShards);
  if (conv.shardId !== myShardId) {
    // Stale shardId on D1 — fix it for future requests
    await db
      .update(conversations)
      .set({ shardId: myShardId, shardUrl: getShardUrl(myShardId, parseShardConfigs(c.env.SHARD_CONFIGS)) })
      .where(eq(conversations.id, conversationId))
      .run();
  }

  // Verify WebSocket upgrade request
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  // Forward to Durable Object with user info in headers
  const doId = c.env.CHAT_ROOM.idFromName(conversationId);
  const stub = c.env.CHAT_ROOM.get(doId);

  // Lazy init-member: fire-and-forget (don't await — reduces connection latency)
  // Conversation creation also calls init-member, so this is belt-and-suspenders.
  stub.fetch("http://do/init-member", {
    method: "POST",
    headers: { "x-do-internal": "true", "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, role: membership.role }),
  }).catch((err) => {
    console.error("Lazy init-member failed for WS connection:", conversationId, user.id, err);
  });

  const headers = new Headers(c.req.raw.headers);
  headers.set("X-User-Id", user.id);
  headers.set("X-User-Name", user.name);
  headers.set("X-User-Picture", user.picture ?? "");
  headers.set("X-Member-Role", membership.role);
  headers.set("X-Rate-Limit-Tier", conv?.rateLimitTier ?? "normal");

  const doRequest = new Request(c.req.raw.url, {
    method: c.req.raw.method,
    headers,
    body: c.req.raw.body,
    redirect: "manual",
  });
  return stub.fetch(doRequest);
});

// ─── Rate Limit Settings ─────────────────────────────────────────────────────

chatRoutes.get("/conversations/:id/rate-limit", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const db = c.var.db;

  // Verify membership
  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership) return c.json({ error: "Not a member" }, 403);

  const conversation = await db
    .select({
      rateLimitTier: conversations.rateLimitTier,
      rateLimitPerMinute: conversations.rateLimitPerMinute,
      rateLimitPerSecond: conversations.rateLimitPerSecond,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conversation) return c.json({ error: "Not found" }, 404);

  return c.json({ rateLimit: conversation });
});

chatRoutes.put("/conversations/:id/rate-limit", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.param("id");
  const db = c.var.db;

  const membership = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, user.id),
      ),
    )
    .get();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Not authorized" }, 403);
  }

  const body = (await c.req.json()) as {
    tier?: string;
    perMinute?: number;
    perSecond?: number;
  };

  const ALLOWED_TIERS = ["relaxed", "normal", "moderate", "strict", "custom"];

  const updates: Record<string, unknown> = {};
  if (body.tier) {
    if (!ALLOWED_TIERS.includes(body.tier)) {
      return c.json({ error: `Invalid tier. Allowed: ${ALLOWED_TIERS.join(", ")}` }, 400);
    }
    updates.rateLimitTier = body.tier;
  }
  if (body.perMinute !== undefined)
    updates.rateLimitPerMinute = Math.max(1, Math.min(100, body.perMinute));
  if (body.perSecond !== undefined)
    updates.rateLimitPerSecond = Math.max(1, Math.min(20, body.perSecond));

  await db.update(conversations).set(updates).where(eq(conversations.id, conversationId)).run();

  // Notify DO to update in-memory tier and broadcast
  try {
    const doId = c.env.CHAT_ROOM.idFromName(conversationId);
    const stub = c.env.CHAT_ROOM.get(doId);
    await stub.fetch("http://do/update-rate-limit", {
      method: "POST",
      headers: { "x-do-internal": "true" },
      body: JSON.stringify({
        tier: body.tier,
        perMinute: body.perMinute,
        perSecond: body.perSecond,
      }),
    });
  } catch { /* best effort */ }

  return c.json({ ok: true });
});

// ─── Debug Endpoints ─────────────────────────────────────────────────────────

chatRoutes.get("/debug/memberships", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = c.var.db;

  const memberships = await db
    .select({
      conversationId: conversationMembers.conversationId,
      userId: conversationMembers.userId,
      role: conversationMembers.role,
      joinedAt: conversationMembers.joinedAt,
      lastReadAt: conversationMembers.lastReadAt,
      unreadCount: conversationMembers.unreadCount,
    })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, user.id))
    .all();

  return c.json({ userId: user.id, memberships });
});


