import { DurableObject } from "cloudflare:workers";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Env {
  DB: D1Database;
}

interface MessageRow {
  id: string;
  sender_id: string;
  content: string;
  type: string;
  reply_to_id: string | null;
  reply_count: number;
  deleted_at: string | null;
  deleted_by: string | null;
  edited_at: string | null;
  created_at: string;
}

interface RateLimitState {
  secondWindow: number[];
  minuteWindow: number[];
}

interface TypingInfo {
  userId: string;
  startedAt: number;
}

// ─── WebSocket Message Envelope ──────────────────────────────────────────────

type ClientMessage =
  | { type: "message_send"; content: string; replyToId?: string }
  | { type: "message_edit"; messageId: string; content: string }
  | { type: "message_delete"; messageId: string }
  | { type: "reaction_add"; messageId: string; emoji: string }
  | { type: "reaction_remove"; messageId: string; emoji: string }
  | { type: "typing_start" }
  | { type: "typing_stop" }
  | { type: "message_read"; messageId: string };

type ServerMessage =
  | { type: "message_new"; message: MessageOutput; senderName: string; senderPicture: string | null }
  | { type: "message_edited"; messageId: string; content: string; editedAt: string }
  | { type: "message_deleted"; messageId: string; deletedBy: string }
  | { type: "reaction_update"; messageId: string; reactions: Record<string, string[]> }
  | { type: "typing_update"; users: TypingInfo[] }
  | { type: "presence_update"; users: { userId: string; online: boolean; lastSeen: number }[] }
  | { type: "error"; message: string }
  | { type: "rate_limited"; retryAfter: number }
  | { type: "group_updated"; conversationId: string; name?: string; description?: string }
  | { type: "rate_limit_updated"; tier: string; perMinute: number; perSecond: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INTERNAL_AUTH_KEY = "x-do-internal";

interface MessageOutput {
  id: string;
  senderId: string;
  content: string;
  type: string;
  replyToId: string | null;
  replyCount: number;
  deletedAt: string | null;
  deletedBy: string | null;
  editedAt: string | null;
  createdAt: string;
  conversationId?: string;
}

function snakeToCamel(row: MessageRow | Record<string, unknown>): MessageOutput {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    senderId: r.sender_id as string,
    content: r.content as string,
    type: r.type as string,
    replyToId: (r.reply_to_id as string | null) ?? null,
    replyCount: (r.reply_count as number) ?? 0,
    deletedAt: (r.deleted_at as string | null) ?? null,
    deletedBy: (r.deleted_by as string | null) ?? null,
    editedAt: (r.edited_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIER_LIMITS: Record<string, { perSecond: number; perMinute: number }> = {
  relaxed: { perSecond: 10, perMinute: 60 },
  normal: { perSecond: 3, perMinute: 40 },
  moderate: { perSecond: 2, perMinute: 20 },
  strict: { perSecond: 1, perMinute: 10 },
  custom: { perSecond: 3, perMinute: 40 },
};

const TYPING_EXPIRY_MS = 10_000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const BATCH_UPDATE_INTERVAL = 100;
const MAX_MESSAGE_LENGTH = 10_000;

// Typing broadcast throttle
const TYPING_BROADCAST_MIN_INTERVAL_MS = 2_000;

// D1 write buffer
const D1_FLUSH_INTERVAL_MS = 500;
const D1_MAX_BUFFER_SIZE = 20;

// Rate limit cleanup interval
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;

// Broadcast batching
const BROADCAST_BATCH_SIZE = 3;
const LARGE_ROOM_THRESHOLD = 50;

// ─── Durable Object ──────────────────────────────────────────────────────────

export class ChatRoom extends DurableObject<Env> {
  private connectedUsers: Map<string, { userId: string; online: boolean; lastSeen: number; connectionCount: number }> = new Map();
  private memberSet: Set<string> = new Set();
  private typingUsers: Map<string, TypingInfo> = new Map();
  private rateLimits: Map<string, RateLimitState> = new Map();
  private messageCounter = 0;
  private conversationId: string;
  private stmtsReady = false;

  // Typing broadcast throttle: last broadcast timestamp
  private lastTypingBroadcast = 0;

  // D1 write buffer
  private d1Buffer: Array<{ sql: string; params: unknown[] }> = [];
  private d1FlushTimer: ReturnType<typeof setTimeout> | null = null;

  // Rate limit cleanup timer
  private rateLimitCleanupTimer: ReturnType<typeof setTimeout> | null = null;

  // Cached member count (avoids COUNT(*) every 100 messages)
  private cachedMemberCount = 0;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.conversationId = state.id.name ?? state.id.toString();
    this.initSQLite();
    this.rebuildConnectedUsers();
    this.scheduleRateLimitCleanup();
  }

  // ─── Rebuild presence from active WebSockets (survives hibernation eviction) ──

  private rebuildConnectedUsers() {
    for (const ws of this.ctx.getWebSockets()) {
      const userId = this.getUserIdFromAttachment(ws);
      if (userId && userId !== "anonymous") {
        const existing = this.connectedUsers.get(userId);
        if (existing) {
          existing.connectionCount++;
        } else {
          this.connectedUsers.set(userId, {
            userId,
            online: true,
            lastSeen: Date.now(),
            connectionCount: 1,
          });
        }
      }
    }
    // Don't broadcast on rebuild — clients will get presence via their own connect
  }

  // ─── SQLite Initialization ───────────────────────────────────────────────

  private initSQLite() {
    if (this.stmtsReady) return;

    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        reply_to_id TEXT,
        reply_count INTEGER DEFAULT 0,
        deleted_at TEXT,
        deleted_by TEXT,
        edited_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);
    this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id)`);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id)`);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS members (
        user_id TEXT PRIMARY KEY,
        role TEXT DEFAULT 'member',
        joined_at TEXT DEFAULT (datetime('now')),
        last_read_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.stmtsReady = true;

    // Populate in-memory member set + cached count for O(1) lookups
    const rows = this.ctx.storage.sql.exec("SELECT user_id FROM members").toArray() as { user_id: string }[];
    for (const row of rows) {
      this.memberSet.add(row.user_id);
    }
    this.cachedMemberCount = this.memberSet.size;
  }

  // ─── Rate Limit Cleanup ─────────────────────────────────────────────────

  private scheduleRateLimitCleanup() {
    if (this.rateLimitCleanupTimer) clearTimeout(this.rateLimitCleanupTimer);
    this.rateLimitCleanupTimer = setTimeout(() => {
      this.cleanupRateLimits();
      this.scheduleRateLimitCleanup();
    }, RATE_LIMIT_CLEANUP_INTERVAL_MS);
  }

  private cleanupRateLimits() {
    const now = Date.now();
    for (const [userId, state] of this.rateLimits) {
      state.secondWindow = state.secondWindow.filter((t) => now - t < 1000);
      state.minuteWindow = state.minuteWindow.filter((t) => now - t < 60_000);
      if (state.secondWindow.length === 0 && state.minuteWindow.length === 0) {
        this.rateLimits.delete(userId);
      }
    }
  }

  // ─── D1 Write Buffer ────────────────────────────────────────────────────

  private bufferD1Write(sql: string, params: unknown[]) {
    this.d1Buffer.push({ sql, params });

    if (this.d1Buffer.length >= D1_MAX_BUFFER_SIZE) {
      this.flushD1Buffer();
    } else if (!this.d1FlushTimer) {
      this.d1FlushTimer = setTimeout(() => {
        this.flushD1Buffer();
      }, D1_FLUSH_INTERVAL_MS);
    }
  }

  private flushD1Buffer() {
    if (this.d1FlushTimer) {
      clearTimeout(this.d1FlushTimer);
      this.d1FlushTimer = null;
    }

    if (this.d1Buffer.length === 0 || !this.env.DB) return;

    const batch = this.d1Buffer.splice(0, D1_MAX_BUFFER_SIZE);
    const statements = batch.map((item) =>
      this.env.DB.prepare(item.sql).bind(...item.params),
    );

    this.ctx.waitUntil(
      this.env.DB
        .batch(statements)
        .catch((err) => {
          console.error("Failed to batch D1 writes:", err);
          for (const item of batch) {
            this.retryD1Write(item.sql, item.params, 0);
          }
        }),
    );

    if (this.d1Buffer.length > 0) {
      this.d1FlushTimer = setTimeout(() => {
        this.flushD1Buffer();
      }, D1_FLUSH_INTERVAL_MS);
    }
  }

  private retryD1Write(sql: string, params: unknown[], attempt: number) {
    if (attempt >= 3 || !this.env.DB) return;

    this.ctx.waitUntil(
      this.env.DB
        .prepare(sql)
        .bind(...params)
        .run()
        .catch((err) => {
          console.error(`D1 write retry ${attempt + 1} failed:`, err);
          this.retryD1Write(sql, params, attempt + 1);
        }),
    );
  }

  // ─── HTTP Fetch ──────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade — this is the primary entry point
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    // Internal endpoints require auth header (called by Worker via stub.fetch)
    const isInternal = request.headers.get(INTERNAL_AUTH_KEY) === "true";

    // POST /init-member — Initialize a member in DO SQLite (called by Worker)
    if (request.method === "POST" && url.pathname === "/init-member") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { userId: string; role: string };
      this.initMember(body.userId, body.role);
      return Response.json({ ok: true });
    }

    // POST /system-message — Insert and broadcast a system message (called by Worker)
    if (request.method === "POST" && url.pathname === "/system-message") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { content: string; senderName?: string };
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      this.ctx.storage.sql.exec(
        `INSERT INTO messages (id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, ?)`,
        id, "system", body.content, "system", now,
      );
      const message: MessageRow = {
        id, sender_id: "system", content: body.content, type: "system",
        reply_to_id: null, reply_count: 0, deleted_at: null, deleted_by: null,
        edited_at: null, created_at: now,
      };

      this.bufferD1Write(
        `INSERT INTO messages (id, conversation_id, sender_id, content, type, reply_to_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [message.id, this.conversationId, message.sender_id, message.content, message.type, message.reply_to_id, message.created_at],
      );

      this.broadcast({ type: "message_new", message: { ...snakeToCamel(message), conversationId: this.conversationId }, senderName: body.senderName ?? "", senderPicture: null });
      return Response.json({ ok: true });
    }

    // POST /update-group-info — Broadcast group info update to connected clients
    if (request.method === "POST" && url.pathname === "/update-group-info") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { conversationId: string; name?: string; description?: string };
      this.broadcast({
        type: "group_updated",
        conversationId: body.conversationId,
        name: body.name,
        description: body.description,
      });
      return Response.json({ ok: true });
    }

    // POST /update-rate-limit — Update in-memory rate limit tier and broadcast
    if (request.method === "POST" && url.pathname === "/update-rate-limit") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { tier?: string; perMinute?: number; perSecond?: number };
      if (body.tier) {
        this.defaultRateLimitTier = body.tier;
      }
      this.broadcast({
        type: "rate_limit_updated",
        tier: body.tier ?? this.defaultRateLimitTier,
        perMinute: body.perMinute ?? 40,
        perSecond: body.perSecond ?? 5,
      });
      return Response.json({ ok: true });
    }

    // POST /remove-member — Remove a member from DO SQLite (called by Worker)
    if (request.method === "POST" && url.pathname === "/remove-member") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { userId: string };
      this.ctx.storage.sql.exec("DELETE FROM members WHERE user_id = ?", body.userId);
      this.memberSet.delete(body.userId);
      this.cachedMemberCount = this.memberSet.size;
      return Response.json({ ok: true });
    }

    // POST /mark-read — Reset unread count for a user (called by Worker)
    if (request.method === "POST" && url.pathname === "/mark-read") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { userId: string };
      this.ctx.storage.sql.exec(
        "UPDATE members SET last_read_at = datetime('now') WHERE user_id = ?",
        body.userId,
      );
      return Response.json({ ok: true });
    }

    // POST /messages — Fetch message history (called by Worker)
    if (request.method === "POST" && url.pathname === "/messages") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { cursor?: string; limit?: number };
      const limit = Math.min(body.limit ?? 50, 100);
      const cursor = body.cursor;

      let query = "SELECT * FROM messages";
      const params: string[] = [];
      if (cursor) {
        query += " WHERE created_at < ?";
        params.push(cursor);
      }
      query += " ORDER BY created_at DESC LIMIT ?";
      params.push(String(limit));

      const results = this.ctx.storage.sql.exec(query, ...params).toArray().map(snakeToCamel);

      const messageIds = results.map((m) => m.id);
      const reactionsMap: Record<string, Record<string, string[]>> = {};

      if (messageIds.length > 0) {
        const placeholders = messageIds.map(() => "?").join(",");
        const reactionRows = this.ctx.storage.sql
          .exec(
            `SELECT message_id, emoji, user_id FROM message_reactions WHERE message_id IN (${placeholders}) ORDER BY created_at ASC`,
            ...messageIds,
          )
          .toArray();

        for (const row of reactionRows) {
          const msgId = row.message_id as string;
          const emoji = row.emoji as string;
          const uid = row.user_id as string;
          if (!reactionsMap[msgId]) reactionsMap[msgId] = {};
          if (!reactionsMap[msgId][emoji]) reactionsMap[msgId][emoji] = [];
          reactionsMap[msgId][emoji].push(uid);
        }
      }

      const enriched = results.map((m) => ({
        ...m,
        reactions: reactionsMap[m.id] ?? {},
      }));

      return Response.json({ messages: enriched });
    }

    // POST /members — Fetch member list (called by Worker)
    if (request.method === "POST" && url.pathname === "/members") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const results = this.ctx.storage.sql
        .exec("SELECT * FROM members ORDER BY joined_at ASC")
        .toArray();
      return Response.json({ members: results });
    }

    // GET / — Connection info
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        conversationId: this.conversationId,
        connectedClients: this.ctx.getWebSockets().length,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  // ─── WebSocket Upgrade ──────────────────────────────────────────────────

  private handleWebSocketUpgrade(request: Request): Response {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const userId = request.headers.get("X-User-Id") || "anonymous";
    const userName = request.headers.get("X-User-Name") || "Unknown";
    const userPicture = request.headers.get("X-User-Picture") || "";
    const memberRole = request.headers.get("X-Member-Role") || "member";
    const rateLimitTier = request.headers.get("X-Rate-Limit-Tier") || "normal";
    server.serializeAttachment({ userId, userName, userPicture, memberRole, rateLimitTier });

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // ─── WebSocket Events ────────────────────────────────────────────────────

  async webSocketOpen(ws: WebSocket) {
    const userId = this.getUserIdFromAttachment(ws);
    if (!userId || userId === "anonymous") return;

    const existing = this.connectedUsers.get(userId);
    if (existing) {
      existing.connectionCount++;
      existing.lastSeen = Date.now();
    } else {
      this.connectedUsers.set(userId, {
        userId,
        online: true,
        lastSeen: Date.now(),
        connectionCount: 1,
      });
    }

    // Broadcast presence change (only this user)
    this.broadcastPresenceDiff([{ userId, online: true, lastSeen: Date.now() }]);
  }

  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer) {
    if (typeof rawMessage !== "string") return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(rawMessage);
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    const userId = this.getUserIdFromAttachment(ws);
    if (!userId || userId === "anonymous") {
      ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
      return;
    }

    switch (msg.type) {
      case "message_send":
        this.handleMessageSend(ws, userId, msg);
        break;
      case "message_edit":
        this.handleMessageEdit(ws, userId, msg);
        break;
      case "message_delete":
        this.handleMessageDelete(ws, userId, msg);
        break;
      case "reaction_add":
        this.handleReactionAdd(ws, userId, msg);
        break;
      case "reaction_remove":
        this.handleReactionRemove(ws, userId, msg);
        break;
      case "typing_start":
        this.handleTypingStart(userId);
        break;
      case "typing_stop":
        this.handleTypingStop(userId);
        break;
      case "message_read":
        this.handleMessageRead(userId, msg.messageId);
        break;
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ) {
    const userId = this.getUserIdFromAttachment(ws);
    if (!userId || userId === "anonymous") return;

    const existing = this.connectedUsers.get(userId);
    if (existing) {
      existing.connectionCount--;
      if (existing.connectionCount <= 0) {
        this.connectedUsers.delete(userId);
        this.typingUsers.delete(userId);
        this.broadcastPresenceDiff([{ userId, online: false, lastSeen: Date.now() }]);
        return;
      }
    }

    if (existing && existing.connectionCount > 0) {
      existing.lastSeen = Date.now();
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error);
    const userId = this.getUserIdFromAttachment(ws);

    if (!userId || userId === "anonymous") return;

    const existing = this.connectedUsers.get(userId);
    if (existing) {
      existing.connectionCount--;
      if (existing.connectionCount <= 0) {
        this.connectedUsers.delete(userId);
        this.typingUsers.delete(userId);
        this.broadcastPresenceDiff([{ userId, online: false, lastSeen: Date.now() }]);
        return;
      }
    }

    if (existing && existing.connectionCount > 0) {
      existing.lastSeen = Date.now();
    }
  }

  // ─── Message Handling ────────────────────────────────────────────────────

  private handleMessageSend(
    ws: WebSocket,
    userId: string,
    msg: Extract<ClientMessage, { type: "message_send" }>,
  ) {
    const userInfo = ws.deserializeAttachment() as { memberRole?: string; rateLimitTier?: string } | null;
    const role = userInfo?.memberRole ?? "member";
    const userTier = userInfo?.rateLimitTier ?? this.defaultRateLimitTier;
    if (role !== "owner" && role !== "admin" && !this.checkRateLimit(userId, userTier)) {
      ws.send(JSON.stringify({ type: "rate_limited", retryAfter: 1 }));
      return;
    }

    if (!this.isMember(userId)) {
      ws.send(JSON.stringify({ type: "error", message: "Failed to send: Not a member" }));
      return;
    }

    if (!msg.content || msg.content.trim().length === 0) {
      ws.send(JSON.stringify({ type: "error", message: "Failed to send: Empty message" }));
      return;
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      ws.send(JSON.stringify({ type: "error", message: "Failed to send: Message too long" }));
      return;
    }

    if (msg.replyToId) {
      const parent = this.ctx.storage.sql
        .exec("SELECT id, reply_count FROM messages WHERE id = ?", msg.replyToId)
        .toArray()[0] as { id: string; reply_count: number } | undefined;

      if (!parent) {
        ws.send(JSON.stringify({ type: "error", message: "Failed to reply: Message not found" }));
        return;
      }

      if (parent.reply_count > 0) {
        ws.send(JSON.stringify({ type: "error", message: "This message already has a reply" }));
        return;
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const message: MessageRow = {
      id,
      sender_id: userId,
      content: msg.content.trim(),
      type: "text",
      reply_to_id: msg.replyToId ?? null,
      reply_count: 0,
      deleted_at: null,
      deleted_by: null,
      edited_at: null,
      created_at: now,
    };

    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO messages (id, sender_id, content, type, reply_to_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        message.id,
        message.sender_id,
        message.content,
        message.type,
        message.reply_to_id,
        message.created_at,
      );
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Failed to save message" }));
      return;
    }

    this.bufferD1Write(
      `INSERT INTO messages (id, conversation_id, sender_id, content, type, reply_to_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [message.id, this.conversationId, message.sender_id, message.content, message.type, message.reply_to_id, message.created_at],
    );

    if (msg.replyToId) {
      try {
        this.ctx.storage.sql.exec(
          "UPDATE messages SET reply_count = reply_count + 1 WHERE id = ?",
          msg.replyToId,
        );
        this.bufferD1Write(
          `UPDATE messages SET reply_count = reply_count + 1 WHERE id = ? AND conversation_id = ?`,
          [msg.replyToId, this.conversationId],
        );
      } catch (err) {
        console.error("Failed to update reply count:", err);
      }
    }

    this.messageCounter++;
    if (this.messageCounter % BATCH_UPDATE_INTERVAL === 0) {
      this.ctx.waitUntil(this.updateD1Metadata(message));
    }

    const senderInfo = ws.deserializeAttachment() as { userName?: string; userPicture?: string } | null;
    this.broadcast({
      type: "message_new",
      message: { ...snakeToCamel(message), conversationId: this.conversationId },
      senderName: senderInfo?.userName ?? "Unknown",
      senderPicture: senderInfo?.userPicture || null,
    });
  }

  private handleMessageEdit(
    ws: WebSocket,
    userId: string,
    msg: Extract<ClientMessage, { type: "message_edit" }>,
  ) {
    if (!msg.content || msg.content.trim().length === 0) {
      ws.send(JSON.stringify({ type: "error", message: "Empty message" }));
      return;
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      ws.send(JSON.stringify({ type: "error", message: "Message too long" }));
      return;
    }

    const row = this.ctx.storage.sql
      .exec("SELECT * FROM messages WHERE id = ?", msg.messageId)
      .toArray()[0];
    const message = row as unknown as MessageRow | undefined;

    if (!message) {
      ws.send(JSON.stringify({ type: "error", message: "Not found" }));
      return;
    }
    if (message.sender_id !== userId) {
      ws.send(JSON.stringify({ type: "error", message: "Failed to edit: Not authorized" }));
      return;
    }
    if (message.type === "system") {
      ws.send(JSON.stringify({ type: "error", message: "Failed to edit: Cannot edit system messages" }));
      return;
    }
    if (Date.now() - new Date(message.created_at).getTime() > EDIT_WINDOW_MS) {
      ws.send(JSON.stringify({ type: "error", message: "Failed to edit: Edit window expired (15 min limit)" }));
      return;
    }

    const editedAt = new Date().toISOString();
    try {
      this.ctx.storage.sql.exec(
        "UPDATE messages SET content = ?, edited_at = ? WHERE id = ?",
        msg.content.trim(),
        editedAt,
        msg.messageId,
      );
    } catch (err) {
      console.error("Failed to edit message:", err);
      ws.send(JSON.stringify({ type: "error", message: "Failed to save edit" }));
      return;
    }

    this.bufferD1Write(
      `UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND conversation_id = ?`,
      [msg.content.trim(), editedAt, msg.messageId, this.conversationId],
    );

    this.broadcast({
      type: "message_edited",
      messageId: msg.messageId,
      content: msg.content.trim(),
      editedAt,
    });
  }

  private handleMessageDelete(
    ws: WebSocket,
    userId: string,
    msg: Extract<ClientMessage, { type: "message_delete" }>,
  ) {
    const row = this.ctx.storage.sql
      .exec("SELECT * FROM messages WHERE id = ?", msg.messageId)
      .toArray()[0];
    const message = row as unknown as MessageRow | undefined;

    if (!message) {
      ws.send(JSON.stringify({ type: "error", message: "Not found" }));
      return;
    }
    if (message.type === "system") {
      ws.send(JSON.stringify({ type: "error", message: "Cannot delete system messages" }));
      return;
    }

    const isSender = message.sender_id === userId;
    const role = this.getMemberRole(userId);
    const isAdmin = role === "owner" || role === "admin";

    if (!isSender && !isAdmin) {
      ws.send(JSON.stringify({ type: "error", message: "Failed to delete: Not authorized" }));
      return;
    }

    const deletedAt = new Date().toISOString();
    try {
      this.ctx.storage.sql.exec(
        "UPDATE messages SET deleted_at = ?, deleted_by = ? WHERE id = ?",
        deletedAt,
        userId,
        msg.messageId,
      );
    } catch (err) {
      console.error("Failed to delete message:", err);
      ws.send(JSON.stringify({ type: "error", message: "Failed to delete message" }));
      return;
    }

    this.bufferD1Write(
      `UPDATE messages SET deleted_at = ?, deleted_by = ? WHERE id = ? AND conversation_id = ?`,
      [deletedAt, userId, msg.messageId, this.conversationId],
    );

    this.broadcast({
      type: "message_deleted",
      messageId: msg.messageId,
      deletedBy: userId,
    });
  }

  // ─── Reactions ───────────────────────────────────────────────────────────

  private handleReactionAdd(
    ws: WebSocket,
    userId: string,
    msg: Extract<ClientMessage, { type: "reaction_add" }>,
  ) {
    const supportedEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "👀", "💯"];
    if (!supportedEmojis.includes(msg.emoji)) {
      ws.send(JSON.stringify({ type: "error", message: "Failed to react: Unsupported emoji" }));
      return;
    }

    const existing = this.ctx.storage.sql
      .exec(
        "SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
        msg.messageId,
        userId,
        msg.emoji,
      )
      .toArray();

    if (existing.length > 0) {
      this.ctx.storage.sql.exec(
        "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
        msg.messageId,
        userId,
        msg.emoji,
      );
      this.bufferD1Write(
        `DELETE FROM message_reactions WHERE conversation_id = ? AND message_id = ? AND user_id = ? AND emoji = ?`,
        [this.conversationId, msg.messageId, userId, msg.emoji],
      );
    } else {
      this.ctx.storage.sql.exec(
        "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?",
        msg.messageId,
        userId,
      );

      this.ctx.storage.sql.exec(
        "INSERT INTO message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)",
        msg.messageId,
        userId,
        msg.emoji,
        new Date().toISOString(),
      );
      this.bufferD1Write(
        `INSERT INTO message_reactions (conversation_id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)`,
        [this.conversationId, msg.messageId, userId, msg.emoji],
      );
    }

    const reactions = this.getReactions(msg.messageId);
    this.broadcast({ type: "reaction_update", messageId: msg.messageId, reactions });
  }

  private handleReactionRemove(
    ws: WebSocket,
    userId: string,
    msg: Extract<ClientMessage, { type: "reaction_remove" }>,
  ) {
    this.ctx.storage.sql.exec(
      "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
      msg.messageId,
      userId,
      msg.emoji,
    );

    this.bufferD1Write(
      `DELETE FROM message_reactions WHERE conversation_id = ? AND message_id = ? AND user_id = ? AND emoji = ?`,
      [this.conversationId, msg.messageId, userId, msg.emoji],
    );

    const reactions = this.getReactions(msg.messageId);
    this.broadcast({ type: "reaction_update", messageId: msg.messageId, reactions });
  }

  private getReactions(messageId: string): Record<string, string[]> {
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT emoji, user_id FROM message_reactions WHERE message_id = ? ORDER BY created_at ASC",
        messageId,
      )
      .toArray();

    const reactions: Record<string, string[]> = {};
    for (const row of rows) {
      const emoji = row.emoji as string;
      const uid = row.user_id as string;
      if (!reactions[emoji]) reactions[emoji] = [];
      reactions[emoji].push(uid);
    }
    return reactions;
  }

  // ─── Typing (Throttled) ────────────────────────────────────────────────

  private handleTypingStart(userId: string) {
    const wasTyping = this.typingUsers.has(userId);
    this.typingUsers.set(userId, { userId, startedAt: Date.now() });
    if (!wasTyping) {
      this.throttledBroadcastTyping();
    }
  }

  private handleTypingStop(userId: string) {
    if (this.typingUsers.delete(userId)) {
      this.throttledBroadcastTyping();
    }
  }

  private throttledBroadcastTyping() {
    const now = Date.now();
    if (now - this.lastTypingBroadcast < TYPING_BROADCAST_MIN_INTERVAL_MS) {
      return;
    }
    this.lastTypingBroadcast = now;
    this.broadcastTyping();
  }

  private broadcastTyping() {
    const now = Date.now();
    for (const [userId, info] of this.typingUsers) {
      if (now - info.startedAt > TYPING_EXPIRY_MS) {
        this.typingUsers.delete(userId);
      }
    }
    this.broadcast({ type: "typing_update", users: Array.from(this.typingUsers.values()) });
  }

  // ─── Presence (Diff-Based) ─────────────────────────────────────────────

  private broadcastPresenceDiff(diffs: Array<{ userId: string; online: boolean; lastSeen: number }>) {
    const data = JSON.stringify({ type: "presence_update", users: diffs });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // Connection might be closing — don't double-decrement, let webSocketClose handle cleanup
      }
    }
  }

  // ─── Read Receipts ───────────────────────────────────────────────────────

  private handleMessageRead(userId: string, messageId: string) {
    const message = this.ctx.storage.sql
      .exec("SELECT created_at FROM messages WHERE id = ?", messageId)
      .toArray()[0] as { created_at: string } | undefined;

    if (message) {
      try {
        this.ctx.storage.sql.exec(
          "UPDATE members SET last_read_at = ? WHERE user_id = ? AND last_read_at < ?",
          message.created_at,
          userId,
          message.created_at,
        );
      } catch (err) {
        console.error("Failed to update read receipt:", err);
      }
    }
  }

  // ─── Rate Limiting (Per-User, Per-Tier) ────────────────────────────────

  private defaultRateLimitTier = "normal";

  private checkRateLimit(userId: string, tier: string): boolean {
    const now = Date.now();
    let state = this.rateLimits.get(userId);

    if (!state) {
      state = { secondWindow: [], minuteWindow: [] };
      this.rateLimits.set(userId, state);
    }

    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.normal;

    if (state.secondWindow.length >= limits.perSecond) return false;
    if (state.minuteWindow.length >= limits.perMinute) return false;

    state.secondWindow.push(now);
    state.minuteWindow.push(now);
    return true;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private initMember(userId: string, role: string) {
    this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO members (user_id, role, joined_at) VALUES (?, ?, ?)",
      userId,
      role,
      new Date().toISOString(),
    );
    this.memberSet.add(userId);
    this.cachedMemberCount = this.memberSet.size;
  }

  private isMember(userId: string): boolean {
    return this.memberSet.has(userId);
  }

  private getMemberRole(userId: string): string {
    const row = this.ctx.storage.sql
      .exec("SELECT role FROM members WHERE user_id = ?", userId)
      .toArray()[0] as { role: string } | undefined;
    return row?.role ?? "member";
  }

  private getUserIdFromAttachment(ws: WebSocket): string | null {
    const state = ws.deserializeAttachment() as { userId?: string } | null;
    return state?.userId ?? null;
  }

  // ─── Broadcast (Batched for Large Rooms) ─────────────────────────────

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    const websockets = this.ctx.getWebSockets().filter((ws) => {
      const userId = this.getUserIdFromAttachment(ws);
      return userId && userId !== "anonymous";
    });
    const count = websockets.length;

    // Small rooms: send directly (no batching overhead)
    if (count <= LARGE_ROOM_THRESHOLD) {
      for (const ws of websockets) {
        try {
          ws.send(data);
        } catch {
          // Connection might be closing — let webSocketClose handle cleanup
        }
      }
      return;
    }

    // Large rooms: batch sends via microtask scheduling
    // This yields the event loop between batches, preventing CPU starvation
    let i = 0;
    const sendNext = () => {
      const end = Math.min(i + BROADCAST_BATCH_SIZE, count);
      for (; i < end; i++) {
        const ws = websockets[i];
        try {
          ws.send(data);
        } catch {
          // Connection might be closing — let webSocketClose handle cleanup
        }
      }
      if (i < count) {
        queueMicrotask(sendNext);
      }
    };
    queueMicrotask(sendNext);
  }

  // ─── D1 Persistence Helpers (Buffered) ──────────────────────────────────

  private async updateD1Metadata(lastMessage: MessageRow) {
    try {
      const memberCount = this.cachedMemberCount;
      const preview = lastMessage.content.slice(0, 100);

      if (this.env.DB) {
        await this.env.DB
          .prepare(
            `UPDATE conversations
             SET last_message_at = ?, last_message_preview = ?, member_count = ?
             WHERE id = ?`,
          )
          .bind(lastMessage.created_at, preview, memberCount, this.conversationId)
          .run();
      }
    } catch (err) {
      console.error("Failed to update D1 metadata:", err);
    }
  }

  // ─── Alarm Handler (survives hibernation) ────────────────────────────────

  async alarm() {
    // Flush any pending D1 writes
    if (this.d1Buffer.length > 0) {
      await this.flushD1Buffer();
    }
    // Schedule next alarm in 5 minutes
    this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000);
  }
}
