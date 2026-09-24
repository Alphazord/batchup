const REQUIRED_ENV_VARS = [
  "SHARD_ID",
  "HMAC_SECRET",
  "ACCOUNT1_CALLBACK_URL",
  "ACCOUNT1_CALLBACK_API_KEY",
  "UPSTASH_REDIS_URL",
] as const;

export interface EnvValidationResult {
  ok: boolean;
  missing: string[];
}

export function validateEnv(env: Record<string, unknown>): EnvValidationResult {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = env[key];
    if (typeof value !== "string" || value.length === 0) {
      missing.push(key);
    }
  }

  return { ok: missing.length === 0, missing };
}
