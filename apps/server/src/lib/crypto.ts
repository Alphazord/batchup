import { hmacHex } from "@repo/http";

export async function hashSession(token: string, secret: string): Promise<string> {
  return hmacHex(secret, token);
}

/**
 * Sign a bearer token using HMAC-SHA256.
 * Returns base64url-encoded payload + "." + hex signature.
 * Uses a derived key separate from session hashing.
 */
export async function signBearerToken(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const payloadJson = JSON.stringify(payload);
  // Use URL-safe base64 (no +, /, = characters)
  const payloadB64 = btoa(payloadJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  // Derive a separate key for bearer tokens to avoid key reuse
  const bearerSecret = await hmacHex(secret, "bearer-token-key");
  const signature = await hmacHex(bearerSecret, payloadB64);
  return `${payloadB64}.${signature}`;
}
