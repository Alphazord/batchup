import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and } from "drizzle-orm";
import {
  createRazorpayOrder,
  fetchRazorpayOrder,
  verifyPaymentSignature,
  validateOrderInput,
  verifyWebhookSignature,
} from "@repo/payments";
import type { RazorpayWebhookEvent } from "@repo/payments";
import { orders, sessions } from "../db/schema";
import { PRODUCTS } from "../config/products";
import { hashSession } from "../lib/crypto";
import { logError } from "../lib/logger";
import { SESSION_TOKEN_LENGTH } from "../constants";
import { getCookie } from "hono/cookie";
import type { Bindings, Variables } from "../types";

export const paymentRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

async function resolveUserId(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<string | null> {
  const sessionToken =
    c.req.header("Authorization")?.replace("Bearer ", "") || getCookie(c, "session");
  if (!sessionToken || sessionToken.length !== SESSION_TOKEN_LENGTH) return null;

  const sessionHash = await hashSession(sessionToken, c.env.SESSION_SECRET);
  const session = await c.var.db.select().from(sessions).where(eq(sessions.id, sessionHash)).get();

  if (!session || session.expiresAt < Math.floor(Date.now() / 1000)) return null;
  return session.userId;
}

paymentRoutes.post("/create-order", async (c) => {
  try {
    const body = await c.req.json<{
      productId?: string;
      productName?: string;
      amount?: number;
      currency?: string;
      customerName?: string;
      customerEmail?: string;
    }>();

    const validationError = validateOrderInput(body);
    if (validationError) {
      return c.json({ success: false, message: validationError }, 400);
    }

    const product = PRODUCTS.find((p: (typeof PRODUCTS)[number]) => p.id === body.productId);
    if (!product) {
      return c.json({ success: false, message: "Unknown product" }, 400);
    }

    const userId = await resolveUserId(c);
    const db = c.var.db;

    const existingPending = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.productId, product.id),
          userId ? eq(orders.userId, userId) : eq(orders.userId, ""),
          eq(orders.status, "pending"),
        ),
      )
      .get();

    if (existingPending) {
      return c.json({
        success: true,
        data: {
          id: existingPending.id,
          razorpayOrderId: existingPending.razorpayOrderId,
          amount: existingPending.amount,
          currency: existingPending.currency,
          keyId: c.env.RAZORPAY_KEY_ID,
        },
      });
    }

    const [inserted] = await db
      .insert(orders)
      .values({
        userId: userId ?? null,
        productId: product.id,
        productName: product.name,
        amount: product.amount,
        currency: product.currency,
        customerName: body.customerName ?? null,
        customerEmail: body.customerEmail ?? null,
        status: "pending",
      })
      .returning();

    const razorpayOrder = await createRazorpayOrder(
      {
        amount: product.amount,
        currency: product.currency,
        receipt: `order_${inserted.id}`,
      },
      c.env.RAZORPAY_KEY_ID,
      c.env.RAZORPAY_KEY_SECRET,
    );

    await db
      .update(orders)
      .set({ razorpayOrderId: razorpayOrder.id, updatedAt: new Date().toISOString() })
      .where(eq(orders.id, inserted.id));

    return c.json({
      success: true,
      data: {
        id: inserted.id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: c.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err: unknown) {
    logError("Create order error", err);
    return c.json({ success: false, message: "Failed to create order" }, 500);
  }
});

paymentRoutes.post("/verify-order", async (c) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = await c.req.json<{
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    }>();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return c.json({ success: false, message: "Missing required fields" }, 400);
    }

    if (!c.env.RAZORPAY_KEY_SECRET) {
      return c.json({ success: false, message: "Payment gateway not configured" }, 500);
    }

    const db = c.var.db;

    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.razorpayOrderId, razorpayOrderId))
      .get();

    if (existingOrder?.status === "paid") {
      return c.json({
        success: true,
        data: {
          orderId: razorpayOrderId,
          paymentId: existingOrder.razorpayPaymentId,
          status: "paid",
        },
      });
    }

    const isValid = await verifyPaymentSignature(
      { razorpayOrderId, razorpayPaymentId, razorpaySignature },
      c.env.RAZORPAY_KEY_SECRET,
    );

    if (!isValid) {
      return c.json(
        {
          success: false,
          message: "Payment verification failed. Invalid signature.",
        },
        400,
      );
    }

    const razorpayOrder = await fetchRazorpayOrder(
      razorpayOrderId,
      c.env.RAZORPAY_KEY_ID,
      c.env.RAZORPAY_KEY_SECRET,
    );

    const dbOrder =
      existingOrder ??
      (await db.select().from(orders).where(eq(orders.razorpayOrderId, razorpayOrderId)).get());

    if (!dbOrder) {
      return c.json({ success: false, message: "Order not found" }, 404);
    }

    if (razorpayOrder.amount !== dbOrder.amount) {
      return c.json({ success: false, message: "Amount mismatch detected" }, 400);
    }

    const [updated] = await db
      .update(orders)
      .set({
        razorpayPaymentId,
        razorpaySignature,
        status: "paid",
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.razorpayOrderId, razorpayOrderId))
      .returning();

    if (!updated) {
      return c.json({ success: false, message: "Order not found" }, 404);
    }

    return c.json({
      success: true,
      data: {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        status: "paid",
      },
    });
  } catch (err: unknown) {
    logError("Verify payment error", err);
    return c.json({ success: false, message: "Payment verification failed" }, 500);
  }
});

paymentRoutes.post("/webhook", async (c) => {
  try {
    const signature = c.req.header("X-Razorpay-Signature");
    if (!signature) {
      return c.json({ success: false, message: "Missing webhook signature" }, 400);
    }

    const body = await c.req.text();

    if (!c.env.RAZORPAY_WEBHOOK_SECRET) {
      logError("RAZORPAY_WEBHOOK_SECRET not configured");
      return c.json({ success: false, message: "Webhook not configured" }, 500);
    }

    const isValid = await verifyWebhookSignature(body, signature, c.env.RAZORPAY_WEBHOOK_SECRET);
    if (!isValid) {
      return c.json({ success: false, message: "Invalid webhook signature" }, 401);
    }

    const event: RazorpayWebhookEvent = JSON.parse(body);
    const db = c.var.db;

    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload.payment?.entity;
        if (!payment) break;

        const existingOrder = await db
          .select()
          .from(orders)
          .where(eq(orders.razorpayOrderId, payment.order_id))
          .get();

        if (existingOrder?.status === "paid") break;

        if (existingOrder && payment.amount !== existingOrder.amount) {
          break;
        }

        await db
          .update(orders)
          .set({
            razorpayPaymentId: payment.id,
            status: "paid",
            paidAt: new Date(payment.created_at * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(orders.razorpayOrderId, payment.order_id));
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment?.entity;
        if (!payment) break;

        const existingOrder = await db
          .select()
          .from(orders)
          .where(eq(orders.razorpayOrderId, payment.order_id))
          .get();

        if (existingOrder?.status === "paid" || existingOrder?.status === "failed") break;

        await db
          .update(orders)
          .set({
            razorpayPaymentId: payment.id,
            status: "failed",
            failureReason: payment.error_description || payment.error_code || "payment_failed",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(orders.razorpayOrderId, payment.order_id));
        break;
      }

      case "payment.authorized":
        break;

      default:
        break;
    }

    return c.json({ success: true });
  } catch (err: unknown) {
    logError("Webhook error", err);
    return c.json({ success: false, message: "Webhook processing failed" }, 500);
  }
});
