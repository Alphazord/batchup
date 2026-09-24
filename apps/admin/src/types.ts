export interface DashboardStats {
  totalUsers: number;
  totalConversations: number;
  dmCount: number;
  groupCount: number;
  totalMessages: number;
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  activeSessions: number;
}

export interface TimelineData {
  users: { date: string; count: number }[];
  orders: { date: string; count: number }[];
  revenue: { date: string; total: number }[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  picture: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

export interface UserDetail {
  user: User;
  conversations: {
    id: string;
    type: string;
    name: string | null;
    member_count: number;
    last_message_at: string | null;
    created_at: string;
    role: string;
    joined_at: string;
    unread_count: number;
  }[];
}

export interface Conversation {
  id: string;
  type: string;
  name: string | null;
  description: string | null;
  createdBy: string;
  memberCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  rateLimitTier: string;
  rateLimitPerMinute: number;
  rateLimitPerSecond: number;
  shardId: number;
  shardUrl: string | null;
  createdAt: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
}

export interface ConversationDetail {
  conversation: Conversation;
  members: {
    conversationId: string;
    userId: string;
    role: string;
    joinedAt: string;
    lastReadAt: string;
    unreadCount: number;
    name: string | null;
    email: string | null;
    picture: string | null;
  }[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  replyToId: string | null;
  replyCount: number;
  deletedAt: string | null;
  deletedBy: string | null;
  editedAt: string | null;
  createdAt: string;
  senderName?: string;
  senderPicture?: string | null;
}

export interface MessageSearchResponse {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
  source: string;
  shardId?: number;
  errors?: { shardId: number; error: string }[];
}

export interface Order {
  id: number;
  userId: string | null;
  productId: string;
  productName: string;
  amount: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export interface OrderListResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

export interface OrderStats {
  totalRevenue: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  byProduct: {
    product_id: string;
    product_name: string;
    total_revenue: number;
    order_count: number;
  }[];
}

export interface ShardHealth {
  id: number;
  name: string;
  status: string;
  latency: number;
  d1?: { status: string; latency: number };
  redis?: { status: string; latency: number };
  circuitBreaker?: { doRequestCount: number; lastResetDay: number };
  conversationCount: number;
}

export interface ShardHealthResponse {
  shards: ShardHealth[];
  acct1ConversationCount: number;
}

export interface SystemHealth {
  database: { status: string; latency: number };
  activeSessions: number;
  shardDistribution: { shard_id: number; count: number }[];
}
