/**
 * Shard assignment logic for conversations.
 *
 * Deterministic: same conversationId always maps to the same shard.
 * Immutable once assigned: no re-sharding needed.
 */

interface ShardConfig {
  id: number;
  name: string;
  url: string;
  cfAccountId: string;
  kvNamespace: string;
}

/**
 * FNV-1a hash for uniform distribution across shards.
 */
function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

/**
 * Assign a conversation to a shard.
 * Returns 1-indexed shard ID (shard 1 = Account 2).
 */
export function assignShard(conversationId: string, totalShards: number): number {
  const hash = fnv1a(conversationId);
  return (hash % totalShards) + 1; // +1 because shards are 1-indexed
}

/**
 * Get the shard URL for a given shard ID.
 */
export function getShardUrl(shardId: number, shardConfigs: ShardConfig[]): string | null {
  const config = shardConfigs.find((c) => c.id === shardId);
  return config?.url ?? null;
}

/**
 * Parse SHARD_CONFIGS env var into structured config.
 * Returns empty array if not configured (single-account mode).
 */
export function parseShardConfigs(raw: string | undefined): ShardConfig[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is ShardConfig =>
        typeof c === "object" &&
        c !== null &&
        "id" in c &&
        "url" in c &&
        typeof (c as ShardConfig).id === "number" &&
        typeof (c as ShardConfig).url === "string",
    );
  } catch {
    return [];
  }
}
