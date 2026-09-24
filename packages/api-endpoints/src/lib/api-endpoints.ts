export const API_ENDPOINTS = {
  // Auth Endpoints
  auth: {
    google: "/auth/google",
    googleCallback: "/auth/google/callback",
    me: "/auth/me",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
  },

  // Health
  health: "/health",

  // Payment Endpoints
  payments: {
    createOrder: "/payments/create-order",
    verifyOrder: "/payments/verify-order",
    webhook: "/payments/webhook",
  },

  // Chat Endpoints
  chat: {
    usersSearch: "/api/chat/users/search",
    conversations: "/api/chat/conversations",
    conversation: (id: string) => `/api/chat/conversations/${id}` as const,
    members: (id: string) => `/api/chat/conversations/${id}/members` as const,
    addMember: (id: string) => `/api/chat/conversations/${id}/members` as const,
    member: (id: string, userId: string) =>
      `/api/chat/conversations/${id}/members/${userId}` as const,
    rateLimit: (id: string) => `/api/chat/conversations/${id}/rate-limit` as const,
    wsToken: "/api/chat/ws-token",
    ws: (conversationId: string) => `/api/chat/ws/${conversationId}` as const,
  },

  // Profile Endpoints
  profile: {
    me: "/api/chat/profile/me",
    update: "/api/chat/profile",
  },
};
