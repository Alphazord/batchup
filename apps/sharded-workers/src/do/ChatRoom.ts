import { DurableObject } from "cloudflare:workers";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Env {
  DB: D1Database;
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_TOKEN: string;
  ACCOUNT1_CALLBACK_URL: string;
  ACCOUNT1_CALLBACK_API_KEY: string;
  SHARD_ID: string;
  DAILY_DO_BUDGET: string;
  WARN_THRESHOLD: string;
  DEGRADE_THRESHOLD: string;
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
  | { type: "ping" }
  | { type: "message_send"; content: string; replyToId?: string; nonce?: string }
  | { type: "message_edit"; messageId: string; content: string }
  | { type: "message_delete"; messageId: string }
  | { type: "reaction_add"; messageId: string; emoji: string }
  | { type: "reaction_remove"; messageId: string; emoji: string }
  | { type: "typing_start" }
  | { type: "typing_stop" }
  | { type: "message_read"; messageId: string };

type ServerMessage =
  | { type: "message_new"; message: MessageOutput; senderName: string; senderPicture: string | null; nonce?: string }
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
const BATCH_UPDATE_INTERVAL = 5;
const MAX_MESSAGE_LENGTH = 10_000;

// ─── Durable Object ──────────────────────────────────────────────────────────

export class ChatRoom extends DurableObject<Env> {
  private connectedUsers: Map<string, { userId: string; online: boolean; lastSeen: number; connectionCount: number; rateLimitTier: string }> = new Map();
  private typingUsers: Map<string, TypingInfo> = new Map();
  private rateLimits: Map<string, RateLimitState> = new Map();
  private pendingUnreadUpdates: Map<string, number> = new Map();
  private messageCounter = 0;
  private conversationId: string;
  private stmtsReady = false;
  private presenceDirty = false;
  private hasSequence = false;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.conversationId = state.id.name ?? state.id.toString();
    this.initSQLite();
    this.rebuildConnectedUsers();
    this.loadPendingUnreadsFromStorage();
    // Set up periodic alarm for rate limit cleanup and pending unreads flush
    this.ctx.storage.getAlarm().then((existing) => {
      if (!existing) {
        this.ctx.storage.setAlarm(Date.now() + 60_000);
      }
    });
  }

  // ─── Rebuild presence from active WebSockets (survives hibernation eviction) ──

  private rebuildConnectedUsers() {
    for (const ws of this.ctx.getWebSockets()) {
      const userId = this.getUserIdFromAttachment(ws);
      if (userId && userId !== "anonymous") {
        const attachment = ws.deserializeAttachment() as { rateLimitTier?: string } | null;
        const tier = attachment?.rateLimitTier ?? "normal";
        const existing = this.connectedUsers.get(userId);
        if (existing) {
          existing.connectionCount++;
        } else {
          this.connectedUsers.set(userId, {
            userId,
            online: true,
            lastSeen: Date.now(),
            connectionCount: 1,
            rateLimitTier: tier,
          });
        }
      }
    }
    if (this.connectedUsers.size > 0) {
      this.broadcastPresence();
    }
  }

  // ─── Alarm (periodic cleanup + pending unreads flush) ──────────────────────

  async alarm() {
    // Flush pending unread updates to storage so they survive hibernation
    this.persistPendingUnreadsToStorage();
    // Re-schedule
    this.ctx.storage.setAlarm(Date.now() + 60_000);
  }

  // ─── Pending Unreads Persistence ─────────────────────────────────────────

  private loadPendingUnreadsFromStorage() {
    try {
      const rows = this.ctx.storage.sql.exec("SELECT user_id, delta FROM pending_unreads").toArray();
      for (const row of rows) {
        this.pendingUnreadUpdates.set(row.user_id as string, row.delta as number);
      }
    } catch {
      // Table may not exist yet
    }
  }

  private persistPendingUnreadsToStorage() {
    if (this.pendingUnreadUpdates.size === 0) return;
    try {
      this.ctx.storage.sql.exec("DELETE FROM pending_unreads");
      for (const [uid, delta] of this.pendingUnreadUpdates) {
        this.ctx.storage.sql.exec(
          "INSERT INTO pending_unreads (user_id, delta) VALUES (?, ?)",
          uid, delta,
        );
      }
    } catch (err) {
      console.error("Failed to persist pending unreads:", err);
    }
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
        created_at TEXT DEFAULT (datetime('now')),
        sequence INTEGER DEFAULT 0
      )
    `);
    // Handle existing databases that don't have the sequence column
    try {
      const cols = this.ctx.storage.sql.exec("PRAGMA table_info(messages)").toArray();
      const hasSequence = cols.some((c) => c.name === "sequence");
      if (!hasSequence) {
        this.ctx.storage.sql.exec("ALTER TABLE messages ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0");
        this.ctx.storage.sql.exec("UPDATE messages SET sequence = rowid WHERE sequence = 0");
      }
      this.hasSequence = hasSequence || cols.some((c) => c.name === "sequence");
    } catch {
      // Table may not exist yet
      this.hasSequence = false;
    }
    this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);
    this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id)`);
    try {
      this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS idx_messages_seq ON messages(sequence)`);
    } catch {
      // sequence column may not exist on existing databases
    }
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
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS pending_unreads (
        user_id TEXT PRIMARY KEY,
        delta INTEGER NOT NULL DEFAULT 0
      )
    `);

    this.stmtsReady = true;
  }

  // ─── HTTP Fetch ──────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    const isInternal = request.headers.get(INTERNAL_AUTH_KEY) === "true";

    if (request.method === "POST" && url.pathname === "/nuke") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      this.ctx.storage.sql.exec("DELETE FROM messages");
      this.ctx.storage.sql.exec("DELETE FROM message_reactions");
      this.ctx.storage.sql.exec("DELETE FROM members");
      this.ctx.storage.sql.exec("DELETE FROM pending_unreads");
      this.connectedUsers.clear();
      this.typingUsers.clear();
      this.rateLimits.clear();
      this.pendingUnreadUpdates.clear();
      this.messageCounter = 0;
      return Response.json({ ok: true, cleared: true });
    }

    if (request.method === "POST" && url.pathname === "/init-member") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { userId: string; role: string };
      this.initMember(body.userId, body.role);
      return Response.json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/system-message") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { content: string; senderName?: string };
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const sequence = this.getNextSequence();
      if (this.hasSequence && sequence > 0) {
        this.ctx.storage.sql.exec(
          `INSERT INTO messages (id, sender_id, content, type, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?)`,
          id, "system", body.content, "system", now, sequence,
        );
      } else {
        this.ctx.storage.sql.exec(
          `INSERT INTO messages (id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, ?)`,
          id, "system", body.content, "system", now,
        );
      }
      const message: MessageRow = {
        id, sender_id: "system", content: body.content, type: "system",
        reply_to_id: null, reply_count: 0, deleted_at: null, deleted_by: null,
        edited_at: null, created_at: now,
      };

      // Persist system message to D1 for durability (non-blocking)
      this.persistMessageToD1(message);

      this.broadcast({ type: "message_new", message: { ...snakeToCamel(message), conversationId: this.conversationId }, senderName: body.senderName ?? "", senderPicture: null });

      this.messageCounter++;
      if (this.messageCounter % BATCH_UPDATE_INTERVAL === 0) {
        this.ctx.waitUntil(this.updateD1Metadata(message));
      }

      return Response.json({ ok: true });
    }

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

    if (request.method === "POST" && url.pathname === "/update-rate-limit") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { tier?: string; perMinute?: number; perSecond?: number };
      // Broadcast the new tier to all connected clients
      if (body.tier) {
        // Update all connected users' tier
        for (const [, userInfo] of this.connectedUsers) {
          userInfo.rateLimitTier = body.tier;
        }
      }
      this.broadcast({
        type: "rate_limit_updated",
        tier: body.tier ?? "normal",
        perMinute: body.perMinute ?? 40,
        perSecond: body.perSecond ?? 3,
      });
      return Response.json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/remove-member") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { userId: string };
      this.ctx.storage.sql.exec("DELETE FROM members WHERE user_id = ?", body.userId);
      this.pendingUnreadUpdates.delete(body.userId);
      return Response.json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/mark-read") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { userId: string };
      this.ctx.storage.sql.exec(
        "UPDATE members SET last_read_at = datetime('now') WHERE user_id = ?",
        body.userId,
      );
      this.pendingUnreadUpdates.delete(body.userId);
      return Response.json({ ok: true });
    }

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

      const messagesWithReactions = results.map((m) => ({
        ...m,
        reactions: reactionsMap[m.id] ?? {},
      }));

      return Response.json({ messages: messagesWithReactions });
    }

    if (request.method === "POST" && url.pathname === "/members") {
      if (!isInternal) return new Response("Forbidden", { status: 403 });
      const rows = this.ctx.storage.sql.exec("SELECT * FROM members").toArray();
      return Response.json({ members: rows });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        conversationId: this.conversationId,
        connectedUsers: this.connectedUsers.size,
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

    const attachment = ws.deserializeAttachment() as { rateLimitTier?: string } | null;
    const tier = attachment?.rateLimitTier ?? "normal";

    const existing = this.connectedUsers.get(userId);
    if (existing) {
      existing.connectionCount++;
      existing.lastSeen = Date.now();
      existing.rateLimitTier = tier;
    } else {
      this.connectedUsers.set(userId, {
        userId,
        online: true,
        lastSeen: Date.now(),
        connectionCount: 1,
        rateLimitTier: tier,
      });
    }

    this.schedulePresenceBroadcast();
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
      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;
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
      }
    }

    this.schedulePresenceBroadcast();
    this.broadcastTyping();
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
      }
    }

    this.schedulePresenceBroadcast();
    this.broadcastTyping();
  }

  // ─── Message Handling ────────────────────────────────────────────────────

  private handleMessageSend(
    ws: WebSocket,
    userId: string,
    msg: Extract<ClientMessage, { type: "message_send" }>,
  ) {
    const userInfo = ws.deserializeAttachment() as { memberRole?: string; rateLimitTier?: string } | null;
    const role = userInfo?.memberRole ?? "member";
    const tier = userInfo?.rateLimitTier ?? "normal";
    if (role !== "owner" && role !== "admin" && !this.checkRateLimit(userId, tier)) {
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
    const sequence = this.getNextSequence();
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
      if (this.hasSequence && sequence > 0) {
        this.ctx.storage.sql.exec(
          `INSERT INTO messages (id, sender_id, content, type, reply_to_id, created_at, sequence)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          message.id,
          message.sender_id,
          message.content,
          message.type,
          message.reply_to_id,
          message.created_at,
          sequence,
        );
      } else {
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
      }
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Failed to save message" }));
      return;
    }

    // Persist to D1 for durability (non-blocking)
    this.persistMessageToD1(message);

    if (msg.replyToId) {
      this.ctx.storage.sql.exec(
        "UPDATE messages SET reply_count = reply_count + 1 WHERE id = ?",
        msg.replyToId,
      );
      this.persistReplyCountToD1(msg.replyToId);
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
      nonce: msg.nonce,
    });

    const memberRows = this.ctx.storage.sql
      .exec("SELECT user_id FROM members WHERE user_id != ?", userId)
      .toArray();
    for (const row of memberRows) {
      const uid = row.user_id as string;
      this.pendingUnreadUpdates.set(uid, (this.pendingUnreadUpdates.get(uid) ?? 0) + 1);
    }
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
    this.ctx.storage.sql.exec(
      "UPDATE messages SET content = ?, edited_at = ? WHERE id = ?",
      msg.content.trim(),
      editedAt,
      msg.messageId,
    );

    // Persist edit to D1 for durability (non-blocking)
    this.persistEditToD1(msg.messageId, msg.content.trim(), editedAt);

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
    this.ctx.storage.sql.exec(
      "UPDATE messages SET deleted_at = ?, deleted_by = ? WHERE id = ?",
      deletedAt,
      userId,
      msg.messageId,
    );

    // Persist delete to D1 for durability (non-blocking)
    this.persistDeleteToD1(msg.messageId, deletedAt, userId);

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
      // Remove from D1 (non-blocking)
      this.removeReactionFromD1(msg.messageId, userId, msg.emoji);
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
      // Persist new reaction to D1 (non-blocking)
      this.persistReactionToD1(msg.messageId, userId, msg.emoji);
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

    // Remove from D1 (non-blocking)
    this.removeReactionFromD1(msg.messageId, userId, msg.emoji);

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

  // ─── Typing ──────────────────────────────────────────────────────────────

  private handleTypingStart(userId: string) {
    this.typingUsers.set(userId, { userId, startedAt: Date.now() });
    this.broadcastTyping();
  }

  private handleTypingStop(userId: string) {
    this.typingUsers.delete(userId);
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

  // ─── Presence ────────────────────────────────────────────────────────────

  private broadcastPresence() {
    const users = Array.from(this.connectedUsers.values()).map((u) => ({
      userId: u.userId,
      online: u.online,
      lastSeen: u.lastSeen,
    }));
    this.broadcast({ type: "presence_update", users });
  }

  // ─── Read Receipts ───────────────────────────────────────────────────────

  private handleMessageRead(userId: string, messageId: string) {
    const message = this.ctx.storage.sql
      .exec("SELECT created_at FROM messages WHERE id = ?", messageId)
      .toArray()[0] as { created_at: string } | undefined;

    if (message) {
      this.ctx.storage.sql.exec(
        "UPDATE members SET last_read_at = ? WHERE user_id = ? AND last_read_at < ?",
        message.created_at,
        userId,
        message.created_at,
      );
    }
  }

  // ─── Rate Limiting ───────────────────────────────────────────────────────

  private checkRateLimit(userId: string, tier: string): boolean {
    const now = Date.now();
    let state = this.rateLimits.get(userId);

    if (!state) {
      state = { secondWindow: [], minuteWindow: [] };
      this.rateLimits.set(userId, state);
    }

    state.secondWindow = state.secondWindow.filter((t) => now - t < 1000);
    state.minuteWindow = state.minuteWindow.filter((t) => now - t < 60_000);

    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.normal;
    if (state.secondWindow.length >= limits.perSecond) return false;
    if (state.minuteWindow.length >= limits.perMinute) return false;

    state.secondWindow.push(now);
    state.minuteWindow.push(now);
    return true;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private getNextSequence(): number {
    try {
      const row = this.ctx.storage.sql
        .exec("SELECT COALESCE(MAX(sequence), 0) + 1 as next FROM messages")
        .toArray()[0] as { next: number } | undefined;
      return row?.next ?? 1;
    } catch {
      return 0;
    }
  }

  private schedulePresenceBroadcast() {
    this.presenceDirty = true;
    // Debounce: coalesce multiple connect/disconnect events within same event loop
    queueMicrotask(() => {
      if (this.presenceDirty) {
        this.presenceDirty = false;
        this.broadcastPresence();
      }
    });
  }

  private initMember(userId: string, role: string) {
    this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO members (user_id, role, joined_at) VALUES (?, ?, ?)",
      userId,
      role,
      new Date().toISOString(),
    );
  }

  private isMember(userId: string): boolean {
    const row = this.ctx.storage.sql
      .exec("SELECT user_id FROM members WHERE user_id = ?", userId)
      .toArray();
    return row.length > 0;
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

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // Connection might be closing
      }
    }
  }

  // ─── D1 Persistence Helpers ──────────────────────────────────────────────

  private async d1Retry(stmt: D1PreparedStatement, maxAttempts = 3): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await stmt.run();
        return true;
      } catch (err) {
        if (attempt === maxAttempts - 1) {
          console.error("D1 write failed after retries:", err);
          return false;
        }
        await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
      }
    }
    return false;
  }

  private persistMessageToD1(message: MessageRow) {
    if (!this.env.DB) return;
    this.ctx.waitUntil(
      this.d1Retry(
        this.env.DB.prepare(
          `INSERT INTO messages (id, conversation_id, sender_id, content, type, reply_to_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          message.id,
          this.conversationId,
          message.sender_id,
          message.content,
          message.type,
          message.reply_to_id,
          message.created_at,
        ),
      ),
    );
  }

  private persistEditToD1(messageId: string, content: string, editedAt: string) {
    if (!this.env.DB) return;
    this.ctx.waitUntil(
      this.d1Retry(
        this.env.DB.prepare(`UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND conversation_id = ?`)
          .bind(content, editedAt, messageId, this.conversationId),
      ),
    );
  }

  private persistDeleteToD1(messageId: string, deletedAt: string, deletedBy: string) {
    if (!this.env.DB) return;
    this.ctx.waitUntil(
      this.d1Retry(
        this.env.DB.prepare(`UPDATE messages SET deleted_at = ?, deleted_by = ? WHERE id = ? AND conversation_id = ?`)
          .bind(deletedAt, deletedBy, messageId, this.conversationId),
      ),
    );
  }

  private persistReplyCountToD1(messageId: string) {
    if (!this.env.DB) return;
    this.ctx.waitUntil(
      this.d1Retry(
        this.env.DB.prepare(`UPDATE messages SET reply_count = reply_count + 1 WHERE id = ? AND conversation_id = ?`)
          .bind(messageId, this.conversationId),
      ),
    );
  }

  private persistReactionToD1(messageId: string, userId: string, emoji: string) {
    if (!this.env.DB) return;
    this.ctx.waitUntil(
      this.d1Retry(
        this.env.DB.prepare(
          `INSERT INTO message_reactions (conversation_id, message_id, user_id, emoji)
           VALUES (?, ?, ?, ?)`,
        ).bind(this.conversationId, messageId, userId, emoji),
      ),
    );
  }

  private removeReactionFromD1(messageId: string, userId: string, emoji: string) {
    if (!this.env.DB) return;
    this.ctx.waitUntil(
      this.d1Retry(
        this.env.DB.prepare(
          `DELETE FROM message_reactions WHERE conversation_id = ? AND message_id = ? AND user_id = ? AND emoji = ?`,
        ).bind(this.conversationId, messageId, userId, emoji),
      ),
    );
  }

  // ─── Metadata Update (HTTP Callback to Account 1) ──────────────────────

  private async updateD1Metadata(lastMessage: MessageRow) {
    try {
      const memberCount =
        (this.ctx.storage.sql.exec("SELECT COUNT(*) as count FROM members").toArray()[0]
          ?.count as number) ?? 0;

      const preview = lastMessage.content.slice(0, 100);

      // Callback to Account 1 for directory metadata
      const callbackUrl = this.env.ACCOUNT1_CALLBACK_URL;
      if (callbackUrl) {
        const updates = [{
          conversationId: this.conversationId,
          lastMessageAt: lastMessage.created_at,
          lastMessagePreview: preview,
          memberCount,
        }];

        const unreadUpdates: Array<{ conversationId: string; userId: string; delta: number }> = [];
        for (const [uid, delta] of this.pendingUnreadUpdates) {
          unreadUpdates.push({
            conversationId: this.conversationId,
            userId: uid,
            delta,
          });
        }

        const body = JSON.stringify({ updates, unreadUpdates });
        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const resp = await fetch(callbackUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Internal-API-Key": this.env.ACCOUNT1_CALLBACK_API_KEY,
              },
              body,
            });
            if (resp.ok) {
              lastError = null;
              this.pendingUnreadUpdates.clear();
              break;
            }
            lastError = new Error(`Callback returned ${resp.status}`);
          } catch (err) {
            lastError = err;
          }
          if (attempt < 1) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
        if (lastError) {
          console.error("Callback to Account 1 failed after retries:", lastError);
        }
      } else {
        this.pendingUnreadUpdates.clear();
      }
    } catch (err) {
      console.error("Failed to update D1 metadata:", err);
    }
  }
}
