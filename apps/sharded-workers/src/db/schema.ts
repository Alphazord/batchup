import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name"),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  memberCount: integer("member_count").notNull().default(0),
  rateLimitTier: text("rate_limit_tier").notNull().default("normal"),
  rateLimitPerSecond: integer("rate_limit_per_second").notNull().default(3),
  rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(40),
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
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("member"),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
    lastReadAt: text("last_read_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
    unreadCount: integer("unread_count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("idx_cm_user").on(t.userId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull(),
    content: text("content").notNull(),
    type: text("type").notNull().default("text"),
    replyToId: text("reply_to_id"),
    replyCount: integer("reply_count").notNull().default(0),
    deletedAt: text("deleted_at"),
    deletedBy: text("deleted_by"),
    editedAt: text("edited_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  },
  (t) => [index("idx_messages_conversation_created").on(t.conversationId, t.createdAt)],
);

export const messageReactions = sqliteTable(
  "message_reactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: text("conversation_id").notNull(),
    messageId: text("message_id").notNull(),
    userId: text("user_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  },
  (t) => [index("idx_reactions_message").on(t.messageId)],
);
