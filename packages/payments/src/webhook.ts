import { hmacHex, constantTimeCompare } from "@repo/http";

export async function verifyWebhookSignature(
  body: string,
  signature: string,
  webhookSecret: string,
): Promise<boolean> {
  const expectedHex = await hmacHex(webhookSecret, body);
  return constantTimeCompare(expectedHex, signature);
}
