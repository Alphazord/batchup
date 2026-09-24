import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'dm' or 'group'
  name: text("name"),
  description: text("description"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  memberCount: integer("member_count").notNull().default(0),
  lastMessageAt: text("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  rateLimitTier: text("rate_limit_tier").notNull().default("normal"),
  rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(40),
  rateLimitPerSecond: integer("rate_limit_per_second").notNull().default(3),
  shardId: integer("shard_id").notNull().default(0),
  shardUrl: text("shard_url"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
});

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner, admin, member
    lastReadAt: text("last_read_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
    unreadCount: integer("unread_count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("idx_conversation_members_user_id").on(t.userId),
  ],
);
