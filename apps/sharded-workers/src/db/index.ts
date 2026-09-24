import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function initDbConnect(env: D1Database) {
  return drizzle(env, { schema });
}
