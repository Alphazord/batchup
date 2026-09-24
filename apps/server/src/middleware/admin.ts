import { constantTimeCompare } from "@repo/http";
import type { Context, Next } from "hono";
import type { Bindings } from "../types";

export async function adminMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const adminKey = c.env.ADMIN_API_KEY;
  if (!adminKey) {
    return c.json({ error: "Admin portal not configured" }, 503);
  }

  const providedKey = c.req.header("X-Admin-API-Key");
  if (!providedKey) {
    return c.json({ error: "Missing admin API key" }, 401);
  }

  const valid = await constantTimeCompare(providedKey, adminKey);
  if (!valid) {
    return c.json({ error: "Invalid admin API key" }, 401);
  }

  await next();
}
