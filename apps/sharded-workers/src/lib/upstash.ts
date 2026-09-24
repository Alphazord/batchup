interface UpstashResponse {
  result: unknown;
  error?: string;
}

export async function upstashCommand(
  url: string,
  token: string,
  ...args: string[]
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  const data = (await response.json()) as UpstashResponse;
  if (data.error) throw new Error(`Upstash: ${data.error}`);
  return data.result;
}

export function getShardRedis(url: string, token: string) {
  return {
    incr: (key: string) => upstashCommand(url, token, "INCR", key),
    expire: (key: string, ttl: number) =>
      upstashCommand(url, token, "EXPIRE", key, String(ttl)),
    get: (key: string) => upstashCommand(url, token, "GET", key),
    set: (key: string, value: string) =>
      upstashCommand(url, token, "SET", key, value),
    setex: (key: string, ttl: number, value: string) =>
      upstashCommand(url, token, "SETEX", key, String(ttl), value),
    sadd: (key: string, ...members: string[]) =>
      upstashCommand(url, token, "SADD", key, ...members),
    srem: (key: string, ...members: string[]) =>
      upstashCommand(url, token, "SREM", key, ...members),
    scard: (key: string) => upstashCommand(url, token, "SCARD", key),
    zadd: (key: string, score: number, member: string) =>
      upstashCommand(url, token, "ZADD", key, String(score), member),
    zremrangebyscore: (key: string, min: number, max: number) =>
      upstashCommand(url, token, "ZREMRANGEBYSCORE", key, String(min), String(max)),
    zcard: (key: string) => upstashCommand(url, token, "ZCARD", key),
  };
}

export async function checkUpstashRateLimit(
  url: string,
  token: string,
  userId: string,
  limit: number = 40,
): Promise<boolean> {
  const db = getShardRedis(url, token);
  const key = `rl:${userId}`;

  const count = await db.incr(key);
  if (count === 1) {
    await db.expire(key, 65);
  }

  return (count as number) <= limit;
}
