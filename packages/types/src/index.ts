export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  picture: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  amount: number;
  currency: string;
  price: string;
  period: string;
  description: string;
  features: readonly string[];
}

export type { RazorpayOrder, RazorpayPayment, RazorpayWebhookEvent } from "./razorpay.js";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "expired" | "cancelled";

// ─── Chat Types ──────────────────────────────────────────────────────────────

export type ConversationType = "dm" | "group";
export type MemberRole = "owner" | "admin" | "member";
export type RateLimitTier = "relaxed" | "normal" | "moderate" | "strict" | "custom";

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string | null;
  createdBy: string;
  memberCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  rateLimitTier: RateLimitTier;
  rateLimitPerMinute: number;
  rateLimitPerSecond: number;
  createdAt: string;
}

export interface ConversationMember {
  conversationId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  name: string;
  picture: string | null;
}

export interface ConversationListItem extends Conversation {
  role: MemberRole;
  joinedAt: string;
  lastReadAt?: string | null;
  otherUserName?: string | null;
  otherUserPicture?: string | null;
  otherUserId?: string | null;
  unreadCount?: number;
}

export interface ChatUser {
  id: string;
  name: string;
  picture: string | null;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  type: "text" | "system";
  replyToId: string | null;
  replyCount: number;
  deletedAt: string | null;
  deletedBy: string | null;
  editedAt: string | null;
  createdAt: string;
  reactions?: Record<string, string[]>;
  pending?: boolean;
  nonce?: string;
}

export interface Reaction {
  emoji: string;
  userId: string;
}

// ─── WebSocket Messages ──────────────────────────────────────────────────────

export type ClientMessage =
  | { type: "message_send"; id: string; content: string; replyToId?: string }
  | { type: "message_edit"; messageId: string; content: string }
  | { type: "message_delete"; messageId: string }
  | { type: "reaction_add"; messageId: string; emoji: string }
  | { type: "reaction_remove"; messageId: string; emoji: string }
  | { type: "typing_start" }
  | { type: "typing_stop" }
  | { type: "message_read"; messageId: string };

export type ServerMessage =
  | { type: "message_new"; message: Message & { conversationId?: string }; senderName: string; senderPicture: string | null; nonce?: string }
  | { type: "message_edited"; messageId: string; content: string; editedAt: string }
  | { type: "message_deleted"; messageId: string; deletedBy: string }
  | { type: "reaction_update"; messageId: string; reactions: Record<string, string[]> }
  | { type: "typing_update"; users: TypingUser[] }
  | { type: "presence_update"; users: PresenceUser[] }
  | { type: "error"; message: string }
  | { type: "rate_limited"; retryAfter: number }
  | { type: "rate_limit_updated"; tier: string; perMinute: number; perSecond: number }
  | { type: "group_updated"; conversationId: string; name?: string; description?: string };

export interface TypingUser {
  userId: string;
  startedAt: number;
}

export interface PresenceUser {
  userId: string;
  online: boolean;
  lastSeen: number;
}

export const SUPPORTED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "👀", "💯"] as const;

export const RATE_LIMIT_TIERS: Record<RateLimitTier, { perSecond: number; perMinute: number; label: string }> = {
  relaxed: { perSecond: 10, perMinute: 60, label: "Relaxed" },
  normal: { perSecond: 5, perMinute: 40, label: "Normal" },
  moderate: { perSecond: 3, perMinute: 20, label: "Moderate" },
  strict: { perSecond: 1, perMinute: 10, label: "Strict" },
  custom: { perSecond: 5, perMinute: 40, label: "Custom" },
};
