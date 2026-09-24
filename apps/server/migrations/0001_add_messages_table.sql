-- Add messages table for D1 message persistence
CREATE TABLE IF NOT EXISTS `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL,
  `sender_id` text NOT NULL,
  `content` text NOT NULL,
  `type` text DEFAULT 'text' NOT NULL,
  `reply_to_id` text,
  `reply_count` integer DEFAULT 0 NOT NULL,
  `deleted_at` text,
  `deleted_by` text,
  `edited_at` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE INDEX IF NOT EXISTS `idx_messages_conversation_created` ON `messages` (`conversation_id`, `created_at`);
