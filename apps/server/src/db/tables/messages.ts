import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { conversations } from "./conversations";

/**
 * Messages are stored in D1 for durability (survives DO eviction).
 * The DO also maintains SQLite for real-time performance.
 * D1 is the source of truth for message history on page load.
 */
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "no action" }),
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
