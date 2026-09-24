"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import { API_ENDPOINTS } from "@repo/api-endpoints";
import { ENV } from "@/config/env";
import { useAuth } from "@/contexts/auth-context";
import type {
  ConversationListItem,
  ConversationMember,
  Message,
  ServerMessage,
  TypingUser,
  PresenceUser,
} from "@repo/types";

type ChatContextType = {
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  messages: Message[];
  members: ConversationMember[];
  membersLoading: boolean;
  onlineUsers: Map<string, PresenceUser>;
  typingUsers: TypingUser[];
  connected: boolean;
  hasEverConnected: boolean;
  loadingConversations: boolean;
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  error: string | null;
  clearError: () => void;
  setActiveConversation: (id: string | null) => void;
  loadOlderMessages: () => Promise<void>;
  sendMessage: (content: string, replyToId?: string) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  removeReaction: (messageId: string, emoji: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  refreshConversations: () => Promise<void>;
  createConversation: (
    type: "dm" | "group",
    name?: string,
    description?: string,
    memberIds?: string[],
  ) => Promise<string>;
  searchUsers: (query: string) => Promise<{ id: string; name: string; picture: string | null }[]>;
  leaveGroup: (conversationId: string) => Promise<void>;
  removeMember: (conversationId: string, userId: string) => Promise<void>;
  addMember: (conversationId: string, userId: string) => Promise<void>;
};

const ChatContext = createContext<ChatContextType | null>(null);

const MESSAGE_BATCH_SIZE = 30;
const PRESENCE_STALE_THRESHOLD = 2 * 60 * 1000;
const CONVERSATION_CACHE_TTL = 30_000;
const MEMBER_CACHE_TTL = 60_000;

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, PresenceUser>>(new Map());
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);
  const loadMembersGeneration = useRef(0);
  const loadMessagesGeneration = useRef(0);
  const markAsReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveRefreshFailures = useRef(0);
  const conversationCache = useRef<{ conversations: ConversationListItem[]; timestamp: number } | null>(null);
  const memberCache = useRef<Map<string, { members: ConversationMember[]; timestamp: number }>>(new Map());
  const activeConversationIdRef = useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const connectWsRef = useRef<(conversationId: string) => void>(() => {});

  // Store latest messages ref for delta sync on reconnect
  const lastMessageIdRef = useRef<string | null>(null);
  const lastMessageTimestampRef = useRef<string | null>(null);
  // Debounced presence updates — batch into one state update per second
  const pendingPresenceRef = useRef<Map<string, PresenceUser>>(new Map());
  const presenceFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Error Auto-Clear ──────────────────────────────────────────────────

  const clearError = useCallback(() => {
    setError(null);
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
      errorTimer.current = null;
    }
  }, []);

  const showError = useCallback(
    (message: string, duration = 8000) => {
      setError(message);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(null), duration);
    },
    [],
  );

  // ─── Conversation List ────────────────────────────────────────────────

  const refreshConversations = useCallback(async () => {
    if (conversationCache.current && Date.now() - conversationCache.current.timestamp < CONVERSATION_CACHE_TTL) {
      setConversations(conversationCache.current.conversations);
      setLoadingConversations(false);
      return;
    }
    try {
      const data = await apiFetch<{ conversations: ConversationListItem[] }>(
        API_ENDPOINTS.chat.conversations,
      );
      setConversations(data.conversations);
      conversationCache.current = { conversations: data.conversations, timestamp: Date.now() };
      consecutiveRefreshFailures.current = 0;
    } catch (err) {
      console.error("[chat] refreshConversations failed:", err);
      consecutiveRefreshFailures.current++;
      if (consecutiveRefreshFailures.current >= 3) {
        showError("Unable to load conversations. Check your connection.");
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [showError]);

  // Initial load
  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // ─── Messages ─────────────────────────────────────────────────────────

  const loadMessages = useCallback(async (conversationId: string, cursor?: string, generation?: number) => {
    setLoadingMessages(true);
    try {
      const data = await apiFetch<{ messages: Message[] }>(
        `/api/chat/conversations/${conversationId}/messages`,
        { method: "POST", body: JSON.stringify({ cursor, limit: MESSAGE_BATCH_SIZE }) },
      );
      setHasMoreMessages(data.messages.length >= MESSAGE_BATCH_SIZE);

      // Track the latest message for delta sync
      if (data.messages.length > 0 && !cursor) {
        const latest = data.messages[data.messages.length - 1];
        lastMessageIdRef.current = latest.id;
        lastMessageTimestampRef.current = latest.createdAt;
      }

      return data.messages;
    } catch {
      return [];
    } finally {
      if (generation === undefined || loadMessagesGeneration.current === generation) {
        setLoadingMessages(false);
      }
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversationId || !hasMoreMessages || loadingMessages) return;

    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    const older = await loadMessages(activeConversationId, oldestMessage.createdAt);
    if (older.length > 0) {
      setMessages((prev) => [...older, ...prev]);
    }
  }, [activeConversationId, hasMoreMessages, loadingMessages, messages, loadMessages]);

  // ─── Members ──────────────────────────────────────────────────────────

  const loadMembers = useCallback(async (conversationId: string, generation: number) => {
    const cached = memberCache.current.get(conversationId);
    if (cached && Date.now() - cached.timestamp < MEMBER_CACHE_TTL) {
      if (loadMembersGeneration.current === generation) {
        setMembers(cached.members);
        setMembersLoading(false);
      }
      return;
    }
    setMembersLoading(true);
    try {
      const data = await apiFetch<{ members: ConversationMember[] }>(
        API_ENDPOINTS.chat.members(conversationId),
      );
      if (loadMembersGeneration.current === generation) {
        setMembers(data.members);
        memberCache.current.set(conversationId, { members: data.members, timestamp: Date.now() });
      }
    } catch {
      if (loadMembersGeneration.current === generation) {
        setMembers([]);
      }
    } finally {
      if (loadMembersGeneration.current === generation) {
        setMembersLoading(false);
      }
    }
  }, []);

  // ─── WebSocket ────────────────────────────────────────────────────────

  const handleWsMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "message_new": {
        // Optimistic: if this matches a pending message by nonce, replace it; otherwise append
        setMessages((prev) => {
          if (msg.nonce) {
            const pendingMatch = prev.findIndex((m) => m.pending && m.nonce === msg.nonce);
            if (pendingMatch !== -1) {
              const updated = [...prev];
              updated[pendingMatch] = { ...msg.message, pending: false };
              lastMessageIdRef.current = msg.message.id;
              lastMessageTimestampRef.current = msg.message.createdAt;
              return updated;
            }
          }
          // Fallback: match by content+sender (for backward compat without nonce)
          const pendingMatch = prev.findIndex(
            (m) => m.pending && m.content === msg.message.content && m.senderId === msg.message.senderId,
          );
          if (pendingMatch !== -1) {
            const updated = [...prev];
            updated[pendingMatch] = { ...msg.message, pending: false };
            lastMessageIdRef.current = msg.message.id;
            lastMessageTimestampRef.current = msg.message.createdAt;
            return updated;
          }
          if (prev.some((m) => m.id === msg.message.id)) return prev;
          lastMessageIdRef.current = msg.message.id;
          lastMessageTimestampRef.current = msg.message.createdAt;
          return [...prev, { ...msg.message, pending: false }];
        });
        // Update conversation list preview + timestamp
        setConversations((prev) => {
          const convId = msg.message.conversationId;
          if (!convId) return prev;
          const updated = prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  lastMessageAt: msg.message.createdAt,
                  lastMessagePreview: msg.message.content.slice(0, 100),
                }
              : c,
          );
          // Only sort if the updated conversation is now newer than the first item
          const first = updated[0];
          if (first && first.id !== convId && msg.message.createdAt > (first.lastMessageAt ?? "")) {
            return updated.sort((a, b) => {
              const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return bTime - aTime;
            });
          }
          return updated;
        });
        // Invalidate conversation cache (Fix 10)
        conversationCache.current = null;
        break;
      }

      case "message_edited":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.messageId
              ? { ...m, content: msg.content, editedAt: msg.editedAt }
              : m,
          ),
        );
        break;

      case "message_deleted":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.messageId
              ? { ...m, deletedAt: new Date().toISOString(), deletedBy: msg.deletedBy }
              : m,
          ),
        );
        break;

      case "reaction_update":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.messageId
              ? { ...m, reactions: msg.reactions }
              : m,
          ),
        );
        break;

      case "typing_update":
        setTypingUsers(msg.users);
        break;

      case "presence_update": {
        const now = Date.now();
        for (const u of msg.users) {
          const isStale = now - u.lastSeen > PRESENCE_STALE_THRESHOLD;
          const effectiveOnline = u.online && !isStale;
          if (effectiveOnline) {
            pendingPresenceRef.current.set(u.userId, u);
          } else if (pendingPresenceRef.current.has(u.userId)) {
            const existing = pendingPresenceRef.current.get(u.userId)!;
            if (u.lastSeen >= existing.lastSeen) {
              pendingPresenceRef.current.delete(u.userId);
            }
          }
        }
        // Flush at most once per second
        if (!presenceFlushTimer.current) {
          presenceFlushTimer.current = setTimeout(() => {
            presenceFlushTimer.current = null;
            const now2 = Date.now();
            setOnlineUsers((prev) => {
              const next = new Map(prev);
              for (const [uid, entry] of pendingPresenceRef.current) {
                if (now2 - entry.lastSeen > PRESENCE_STALE_THRESHOLD) {
                  next.delete(uid);
                } else {
                  next.set(uid, entry);
                }
              }
              pendingPresenceRef.current.clear();
              return next;
            });
          }, 1000);
        }
        break;
      }

      case "rate_limited":
        showError(`Slow down! Wait ${msg.retryAfter}s`, 5000);
        break;

      case "error":
        showError(msg.message);
        break;

      case "rate_limit_updated":
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationIdRef.current
              ? {
                  ...c,
                  rateLimitTier: msg.tier as ConversationListItem["rateLimitTier"],
                  rateLimitPerMinute: msg.perMinute,
                  rateLimitPerSecond: msg.perSecond,
                }
              : c,
          ),
        );
        break;

      case "group_updated":
        setConversations((prev) =>
          prev.map((c) =>
            c.id === msg.conversationId
              ? {
                  ...c,
                  name: msg.name ?? c.name,
                  description: msg.description ?? c.description,
                }
              : c,
          ),
        );
        break;


    }
  }, [showError]);

  const connectWs = useCallback(
    (conversationId: string) => {
      // Cleanup existing
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      apiFetch<{ token: string; shardUrl: string | null }>(
        `${API_ENDPOINTS.chat.wsToken}?conversationId=${conversationId}`,
      )
        .then(({ token, shardUrl }) => {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          // Use shard URL if available (sharded mode), otherwise Account 1
          const host = shardUrl
            ? new URL(shardUrl).host
            : new URL(ENV.serverUrl).host;
          const path = shardUrl
            ? `/ws/${conversationId}?token=${token}`
            : `/api/chat/ws/${conversationId}?token=${token}`;
          const wsUrl = `${protocol}//${host}${path}`;

          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = async () => {
            setConnected(true);
            setHasEverConnected(true);
            reconnectAttempts.current = 0;

            // Delta sync: if we have a last message timestamp, fetch only new messages
            if (lastMessageTimestampRef.current) {
              try {
                const data = await apiFetch<{ messages: Message[] }>(
                  `/api/chat/conversations/${conversationId}/messages`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      cursor: lastMessageTimestampRef.current,
                      limit: MESSAGE_BATCH_SIZE,
                    }),
                  },
                );
                if (data.messages.length > 0) {
                  // Append new messages (they're older than cursor, so reverse for chronological)
                  const newMessages = data.messages.reverse();
                  setMessages((prev) => {
                    const existingIds = new Set(prev.map((m) => m.id));
                    const uniqueNew = newMessages.filter((m) => !existingIds.has(m.id));
                    if (uniqueNew.length === 0) return prev;
                    return [...prev, ...uniqueNew];
                  });
                }
              } catch {
                // Fallback: refresh conversations
                await refreshConversations();
              }
            } else {
              // First load: refresh conversations
              await refreshConversations();
            }
          };

          ws.onmessage = (event) => {
            if (typeof event.data !== "string") return;
            try {
              const msg = JSON.parse(event.data) as ServerMessage;
              handleWsMessage(msg);
            } catch {
              // Ignore
            }
          };

          ws.onclose = () => {
            // Only reconnect if this is still the current WebSocket
            if (wsRef.current !== ws) return;
            setConnected(false);
            wsRef.current = null;
            const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30_000);
            reconnectAttempts.current++;
            reconnectTimer.current = setTimeout(() => connectWsRef.current(conversationId), delay);
          };

          ws.onerror = () => ws.close();
        })
        .catch(() => {
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30_000);
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(() => connectWsRef.current(conversationId), delay);
        });
    },
    // Only depend on stable references — handleWsMessage and refreshConversations
    // are memoized with useCallback and won't change identity
    [handleWsMessage, refreshConversations],
  );
  connectWsRef.current = connectWs;

  // ─── WebSocket Reconnect on Tab Focus ─────────────────────────────────
  // When the user returns to the tab, check if the WS is still open.
  // Mobile browsers often kill idle connections in the background.

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && activeConversationId) {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING || wsRef.current.readyState === WebSocket.CONNECTING) {
          connectWs(activeConversationId);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeConversationId, connectWs]);

  // ─── Actions ──────────────────────────────────────────────────────────

  const sendWs = useCallback(
    (msg: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
        return true;
      }
      showError("Not connected. Reconnecting...", 5000);
      return false;
    },
    [showError],
  );

  const startTyping = useCallback(() => {
    if (!isTyping.current) {
      isTyping.current = true;
      sendWs({ type: "typing_start" });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      sendWs({ type: "typing_stop" });
    }, 3000);
  }, [sendWs]);

  const stopTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (isTyping.current) {
      isTyping.current = false;
      sendWs({ type: "typing_stop" });
    }
  }, [sendWs]);

  // ─── Active Conversation ──────────────────────────────────────────────

  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      await apiFetch(`/api/chat/conversations/${conversationId}/read`, { method: "POST" });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, lastReadAt: new Date().toISOString() } : c,
        ),
      );
    } catch {
      // Silent fail
    }
  }, []);

  const setActiveConversation = useCallback(
    async (id: string | null) => {
      setActiveConversationId(id);
      setMessages([]);
      setMembers([]);
      setMembersLoading(true);
      setTypingUsers([]);
      setHasMoreMessages(true);
      lastMessageIdRef.current = null;
      lastMessageTimestampRef.current = null;
      stopTyping();

      if (id) {
        const gen = ++loadMessagesGeneration.current;
        const msgs = await loadMessages(id, undefined, gen);
        if (loadMessagesGeneration.current === gen) {
          setMessages([...msgs].reverse());
          loadMembersGeneration.current++;
          loadMembers(id, loadMembersGeneration.current);
          connectWs(id);
          markAsRead(id);
        }
      } else {
        if (wsRef.current) {
          wsRef.current.onclose = null;
          wsRef.current.close();
          wsRef.current = null;
        }
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
        setConnected(false);
        setMembersLoading(false);
      }
    },
    [loadMessages, loadMembers, connectWs, markAsRead, stopTyping],
  );

  // ─── Auto-mark-read on incoming messages (debounced) ──────────────────
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      if (markAsReadTimer.current) clearTimeout(markAsReadTimer.current);
      markAsReadTimer.current = setTimeout(() => {
        if (activeConversationIdRef.current) markAsRead(activeConversationIdRef.current);
      }, 3000);
    }
    return () => {
      if (markAsReadTimer.current) clearTimeout(markAsReadTimer.current);
    };
  }, [messages.length, activeConversationId, markAsRead]);

  // ─── WS Heartbeat ──────────────────────────────────────────────────────
  // Detect silent WebSocket disconnects (NAT timeout, network switch, etc.)

  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    heartbeatTimer.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30_000);
    return () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };
  }, []);

  // ─── Online/Offline Network Detection ──────────────────────────────────

  useEffect(() => {
    const handleOnline = () => {
      if (activeConversationIdRef.current && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
        connectWs(activeConversationIdRef.current);
      }
    };
    const handleOffline = () => {
      setConnected(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connectWs]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (markAsReadTimer.current) clearTimeout(markAsReadTimer.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (presenceFlushTimer.current) clearTimeout(presenceFlushTimer.current);
    };
  }, []);

  // ─── Actions ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (content: string, replyToId?: string) => {
      const nonce = crypto.randomUUID();
      // Optimistic: add message to UI immediately
      const optimisticMessage: Message = {
        id: `temp-${nonce}`,
        senderId: user?.id ?? "",
        content,
        type: "text",
        replyToId: replyToId ?? null,
        replyCount: 0,
        deletedAt: null,
        deletedBy: null,
        editedAt: null,
        createdAt: new Date().toISOString(),
        reactions: {},
        pending: true,
        nonce,
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      const sent = sendWs({
        type: "message_send",
        content,
        replyToId,
        nonce,
      });
      if (!sent) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      }
    },
    [sendWs, user],
  );

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      sendWs({ type: "message_edit", messageId, content });
    },
    [sendWs],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      sendWs({ type: "message_delete", messageId });
    },
    [sendWs],
  );

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      sendWs({ type: "reaction_add", messageId, emoji });
    },
    [sendWs],
  );

  const removeReaction = useCallback(
    (messageId: string, emoji: string) => {
      sendWs({ type: "reaction_remove", messageId, emoji });
    },
    [sendWs],
  );

  // ─── API Actions ──────────────────────────────────────────────────────

  const createConversation = useCallback(
    async (
      type: "dm" | "group",
      name?: string,
      description?: string,
      memberIds?: string[],
    ): Promise<string> => {
      const data = await apiFetch<{ conversationId: string }>(
        API_ENDPOINTS.chat.conversations,
        {
          method: "POST",
          body: JSON.stringify({ type, name, description, memberIds }),
        },
      );
      conversationCache.current = null;
      await refreshConversations();
      return data.conversationId;
    },
    [refreshConversations],
  );

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 1) return [];
    const data = await apiFetch<{ users: { id: string; name: string; picture: string | null }[] }>(
      `${API_ENDPOINTS.chat.usersSearch}?q=${encodeURIComponent(query)}`,
    );
    return data.users;
  }, []);

  // ─── Group Management ────────────────────────────────────────────────

  const leaveGroup = useCallback(
    async (conversationId: string) => {
      await apiFetch(API_ENDPOINTS.chat.conversation(conversationId), { method: "DELETE" });
      conversationCache.current = null;
      await refreshConversations();
    },
    [refreshConversations],
  );

  const removeMember = useCallback(
    async (conversationId: string, userId: string) => {
      await apiFetch(API_ENDPOINTS.chat.member(conversationId, userId), { method: "DELETE" });
      conversationCache.current = null;
      memberCache.current.delete(conversationId);
      await refreshConversations();
    },
    [refreshConversations],
  );

  const addMember = useCallback(
    async (conversationId: string, userId: string) => {
      await apiFetch(API_ENDPOINTS.chat.addMember(conversationId), {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      conversationCache.current = null;
      memberCache.current.delete(conversationId);
      await refreshConversations();
    },
    [refreshConversations],
  );

  // ─── Value ────────────────────────────────────────────────────────────

  const value = useMemo<ChatContextType>(
    () => ({
      conversations,
      activeConversationId,
      messages,
      members,
      membersLoading,
      onlineUsers,
      typingUsers,
      connected,
      hasEverConnected,
      loadingConversations,
      loadingMessages,
      hasMoreMessages,
      error,
      clearError,
      setActiveConversation,
      loadOlderMessages,
      sendMessage,
      editMessage,
      deleteMessage,
      addReaction,
      removeReaction,
      startTyping,
      stopTyping,
      refreshConversations,
      createConversation,
      searchUsers,
      leaveGroup,
      removeMember,
      addMember,
    }),
    [
      conversations,
      activeConversationId,
      messages,
      members,
      membersLoading,
      onlineUsers,
      typingUsers,
      connected,
      hasEverConnected,
      loadingConversations,
      loadingMessages,
      hasMoreMessages,
      error,
      clearError,
      setActiveConversation,
      loadOlderMessages,
      sendMessage,
      editMessage,
      deleteMessage,
      addReaction,
      removeReaction,
      startTyping,
      stopTyping,
      refreshConversations,
      createConversation,
      searchUsers,
      leaveGroup,
      removeMember,
      addMember,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
