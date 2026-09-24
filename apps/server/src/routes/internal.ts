import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { conversations, conversationMembers } from "../db/schema";
import { constantTimeCompare } from "@repo/http";
import type { Bindings, Variables } from "../types";

export const internalRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware: verify internal API key
internalRoutes.use("*", async (c, next) => {
  const apiKey = c.req.header("X-Internal-API-Key");
  if (!apiKey || !(await constantTimeCompare(apiKey, c.env.SHARD_CALLBACK_API_KEY ?? ""))) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});

// Batch metadata update from shards
internalRoutes.post("/shard-callback", async (c) => {
  const body = (await c.req.json()) as {
    updates: Array<{
      conversationId: string;
      lastMessageAt: string;
      lastMessagePreview: string;
      memberCount: number;
    }>;
    unreadUpdates: Array<{
      conversationId: string;
      userId: string;
      delta: number;
    }>;
  };

  // Input validation
  const MAX_UPDATES = 100;
  const MAX_UNREAD_UPDATES = 1000;
  if (!body.updates || !Array.isArray(body.updates) || body.updates.length > MAX_UPDATES) {
    return c.json({ error: `updates must be an array with at most ${MAX_UPDATES} items` }, 400);
  }
  if (!body.unreadUpdates || !Array.isArray(body.unreadUpdates) || body.unreadUpdates.length > MAX_UNREAD_UPDATES) {
    return c.json({ error: `unreadUpdates must be an array with at most ${MAX_UNREAD_UPDATES} items` }, 400);
  }

  const db = c.var.db;

  // Update conversation metadata — Account 1 D1 is source of truth for memberCount
  await Promise.allSettled(
    body.updates.map((u) =>
      db
        .update(conversations)
        .set({
          lastMessageAt: u.lastMessageAt,
          lastMessagePreview: u.lastMessagePreview,
        })
        .where(eq(conversations.id, u.conversationId))
        .run(),
    ),
  );

  // Increment unread counts
  await Promise.allSettled(
    body.unreadUpdates
      .filter((u) => typeof u.delta === "number" && Math.abs(u.delta) <= 1000)
      .map((u) =>
        db
          .update(conversationMembers)
          .set({ unreadCount: sql`MAX(0, ${conversationMembers.unreadCount} + ${u.delta})` })
          .where(
            and(
              eq(conversationMembers.conversationId, u.conversationId),
              eq(conversationMembers.userId, u.userId),
            ),
          )
          .run(),
      ),
  );

  return c.json({ ok: true });
});
