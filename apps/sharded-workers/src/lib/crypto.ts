import { hmacHex, constantTimeCompare } from "@repo/http";

/**
 * Verify an HMAC-signed bearer token.
 * Returns the decoded payload or null if invalid/expired.
 */
export async function verifyBearerToken(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  // Derive the same key used for signing
  const bearerSecret = await hmacHex(secret, "bearer-token-key");
  const expectedSig = await hmacHex(bearerSecret, payloadB64);
  if (!(await constantTimeCompare(signature, expectedSig))) return null;

  try {
    // Handle both standard and URL-safe base64
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
