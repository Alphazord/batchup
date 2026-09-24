import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * Reactions are stored in D1 for cross-DO querying.
 * The DO also maintains an in-memory cache for real-time performance.
 */
export const messageReactions = sqliteTable(
  "message_reactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: text("conversation_id").notNull(),
    messageId: text("message_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  },
  (t) => [index("idx_reactions_conversation_message").on(t.conversationId, t.messageId)],
);
