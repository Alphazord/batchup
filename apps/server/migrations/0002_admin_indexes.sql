-- Admin portal performance indexes
CREATE INDEX IF NOT EXISTS idx_conversations_shard_id ON conversations(shard_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
