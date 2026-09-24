-- Performance index for message_reactions queries
CREATE INDEX IF NOT EXISTS idx_reactions_conversation_message ON message_reactions(conversation_id, message_id);
