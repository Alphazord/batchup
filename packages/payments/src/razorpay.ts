import type { RazorpayOrderCreateParams, RazorpayOrder } from "./types";
import { fetchWithTimeout, hmacHex, constantTimeCompare } from "@repo/http";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${toBase64Url(`${keyId}:${keySecret}`)}`;
}

export async function createRazorpayOrder(
  params: RazorpayOrderCreateParams,
  keyId: string,
  keySecret: string,
): Promise<RazorpayOrder> {
  const response = await fetchWithTimeout(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(keyId, keySecret),
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: { description?: string } };
    throw new Error(
      `Razorpay order creation failed: ${error.error?.description || response.statusText}`,
    );
  }

  return response.json() as Promise<RazorpayOrder>;
}

export async function fetchRazorpayOrder(
  orderId: string,
  keyId: string,
  keySecret: string,
): Promise<RazorpayOrder> {
  const response = await fetchWithTimeout(`${RAZORPAY_API_BASE}/orders/${orderId}`, {
    headers: {
      Authorization: buildAuthHeader(keyId, keySecret),
    },
  });

  if (!response.ok) {
    throw new Error(`Razorpay order fetch failed: ${response.statusText}`);
  }

  return response.json() as Promise<RazorpayOrder>;
}

export async function generateSignature(
  orderId: string,
  paymentId: string,
  keySecret: string,
): Promise<string> {
  return hmacHex(keySecret, `${orderId}|${paymentId}`);
}

export async function verifyPaymentSignature(
  params: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  keySecret: string,
): Promise<boolean> {
  const expectedSignature = await generateSignature(
    params.razorpayOrderId,
    params.razorpayPaymentId,
    keySecret,
  );
  return constantTimeCompare(expectedSignature, params.razorpaySignature);
}

export function validateOrderInput(input: {
  productId?: string;
  productName?: string;
  amount?: number;
  currency?: string;
  customerEmail?: string;
}): string | null {
  if (!input.productId || input.productId.length > 255) return "Invalid productId";
  if (!input.productName || input.productName.length > 255) return "Invalid productName";
  if (!input.amount || input.amount <= 0 || !Number.isInteger(input.amount))
    return "Amount must be a positive integer";
  if (input.currency && !/^[A-Z]{3}$/.test(input.currency)) return "Invalid currency code";
  if (input.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail))
    return "Invalid email";
  return null;
}
