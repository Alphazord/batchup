export interface RazorpayOrderCreateParams {
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  amount_due: number;
  amount_paid: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  created_at: number;
}

export interface RazorpayPaymentVerifyParams {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface RazorpayWebhookEvent {
  event: string;
  payload: {
    order: { entity: RazorpayOrder };
    payment?: { entity: RazorpayPayment };
  };
}

export interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  method: string;
  captured: boolean;
  created_at: number;
  error_code?: string;
  error_description?: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "expired" | "cancelled";

export interface CreateOrderInput {
  productId: string;
  productName: string;
  amount: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  userId?: string;
}

export interface VerifyPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}
