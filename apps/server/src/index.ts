import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";

import { initDbConnect } from "./db";

import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { paymentRoutes } from "./routes/payment";
import { chatRoutes } from "./routes/chat";
import { internalRoutes } from "./routes/internal";
import { adminRoutes } from "./routes/admin";
import { adminMiddleware } from "./middleware/admin";

import { ChatRoom } from "./do/ChatRoom";
import { logError } from "./lib/logger";
import { parseAllowedOrigins } from "./lib/origins";
import { validateEnv } from "./env";
import type { Bindings, Variables } from "./types";

export { ChatRoom };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
let envValidated = false;

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("CF-Connecting-IP") || "unknown";
}

app.use("/*", logger());
app.use("/*", async (c, next) => {
  if (c.req.header("Upgrade")?.toLowerCase() === "websocket") {
    return next();
  }
  return bodyLimit({ maxSize: MAX_BODY_BYTES })(c, next);
});
app.use("/*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Cache-Control", "private, no-cache");

  const requestId = crypto.randomUUID();
  c.header("X-Request-Id", requestId);

  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGINS);

    return cors({
      origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "Upgrade",
        "Sec-WebSocket-Key",
        "Sec-WebSocket-Version",
        "Sec-WebSocket-Protocol",
        "Sec-WebSocket-Extensions",
        "X-Admin-API-Key",
      ],
      maxAge: 86400,
    })(c, next);
});

app.use("/*", async (c, next) => {
  if (!envValidated) {
    const result = validateEnv(c.env as unknown as Record<string, unknown>);
    envValidated = true;
    if (!result.ok) {
      return c.json({ error: "Server misconfigured", missing: result.missing }, 500);
    }
  }
  c.set("db", initDbConnect(c.env.DB));
  await next();
});

app.use("/auth/*", async (c, next) => {
  const ip = getClientIp(c);
  const { success } = await c.env.AUTH_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return c.json({ error: "Too many requests" }, 429);
  }
  await next();
});

app.use("/payments/*", async (c, next) => {
  const ip = getClientIp(c);
  const { success } = await c.env.SESSION_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return c.json({ error: "Too many requests" }, 429);
  }
  await next();
});

app.use("/api/chat/*", async (c, next) => {
  const ip = getClientIp(c);
  const { success } = await c.env.CHAT_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return c.json({ error: "Too many requests" }, 429);
  }
  await next();
});

app.route("/", healthRoutes);
app.route("/auth", authRoutes);
app.route("/payments", paymentRoutes);
app.route("/api/chat", chatRoutes);

// Internal shard callback — rate limited by IP
app.use("/api/internal/*", async (c, next) => {
  const ip = getClientIp(c);
  const { success } = await c.env.CHAT_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return c.json({ error: "Too many requests" }, 429);
  }
  await next();
});
app.route("/api/internal", internalRoutes);

// Admin API — rate limited, API key protected
app.use("/api/admin/*", async (c, next) => {
  const ip = getClientIp(c);
  const { success } = await c.env.CHAT_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return c.json({ error: "Too many requests" }, 429);
  }
  await next();
});
app.use("/api/admin/*", adminMiddleware);
app.route("/api/admin", adminRoutes);

app.onError((err, c) => {
  logError("Unhandled error", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

app.notFound((c) => c.json({ error: "Not Found" }, 404));

export default app;
