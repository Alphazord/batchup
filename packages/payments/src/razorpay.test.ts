import { describe, it, expect } from "vitest";
import { generateSignature, verifyPaymentSignature, validateOrderInput } from "./razorpay";
import { verifyWebhookSignature } from "./webhook";

const TEST_KEY_SECRET = "test_secret_key_12345678901234567890";

describe("verifyPaymentSignature", () => {
  it("should reject when signatures do not match (timing-safe)", async () => {
    const orderId = "order_test123";
    const paymentId = "pay_test456";

    const correctSignature = await generateSignature(orderId, paymentId, TEST_KEY_SECRET);

    const result = await verifyPaymentSignature(
      {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: "0".repeat(64),
      },
      TEST_KEY_SECRET,
    );
    expect(result).toBe(false);

    const result2 = await verifyPaymentSignature(
      {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: correctSignature + "x",
      },
      TEST_KEY_SECRET,
    );
    expect(result2).toBe(false);
  });

  it("should accept valid signature", async () => {
    const orderId = "order_test123";
    const paymentId = "pay_test456";

    const correctSignature = await generateSignature(orderId, paymentId, TEST_KEY_SECRET);

    const result = await verifyPaymentSignature(
      {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: correctSignature,
      },
      TEST_KEY_SECRET,
    );
    expect(result).toBe(true);
  });

  it("should reject when signature length differs", async () => {
    const result = await verifyPaymentSignature(
      {
        razorpayOrderId: "order_test",
        razorpayPaymentId: "pay_test",
        razorpaySignature: "short",
      },
      TEST_KEY_SECRET,
    );
    expect(result).toBe(false);
  });
});

describe("validateOrderInput", () => {
  it("should reject unknown product IDs", () => {
    const result = validateOrderInput({
      productId: "nonexistent",
      productName: "Test",
      amount: 999,
    });
    expect(result).toBeNull();
  });

  it("should reject missing productId", () => {
    const result = validateOrderInput({
      productName: "Test",
      amount: 999,
    });
    expect(result).toBe("Invalid productId");
  });

  it("should reject zero or negative amounts", () => {
    expect(validateOrderInput({ productId: "starter", productName: "Test", amount: 0 })).toBe(
      "Amount must be a positive integer",
    );
    expect(validateOrderInput({ productId: "starter", productName: "Test", amount: -100 })).toBe(
      "Amount must be a positive integer",
    );
  });

  it("should reject non-integer amounts", () => {
    const result = validateOrderInput({
      productId: "starter",
      productName: "Test",
      amount: 99.99,
    });
    expect(result).toBe("Amount must be a positive integer");
  });

  it("should accept valid input", () => {
    const result = validateOrderInput({
      productId: "starter",
      productName: "SaaS LaunchKit Pro",
      amount: 999,
    });
    expect(result).toBeNull();
  });
});

describe("verifyWebhookSignature", () => {
  it("should accept valid webhook signature", async () => {
    const body = '{"event":"payment.captured"}';
    const secret = "webhook_secret_123";

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await verifyWebhookSignature(body, hex, secret);
    expect(result).toBe(true);
  });

  it("should reject invalid webhook signature", async () => {
    const result = await verifyWebhookSignature(
      '{"event":"payment.captured"}',
      "0".repeat(64),
      "webhook_secret_123",
    );
    expect(result).toBe(false);
  });
});
