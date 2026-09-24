const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8787";

function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_api_key");
}

export async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() ?? "GET";
  const isBodyMethod = method === "POST" || method === "PUT" || method === "PATCH";

  const headers: Record<string, string> = {};
  if (isBodyMethod) {
    headers["Content-Type"] = "application/json";
  }

  const apiKey = getApiKey();
  if (apiKey) {
    headers["X-Admin-API-Key"] = apiKey;
  }

  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error || body?.message || `API error: ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function testApiKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/admin/stats`, {
      headers: { "X-Admin-API-Key": key },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
