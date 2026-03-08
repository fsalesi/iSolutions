/**
 * Database connection pool.
 *
 * Uses node-postgres (pg) with a singleton Pool.
 * Import { db } anywhere in server code to run queries.
 *
 * Usage:
 *   import { db } from "@/lib/db";
 *   const { rows } = await db.query("SELECT * FROM users WHERE user_id = $1", [id]);
 */

import { Pool } from "pg";
import { config } from "./config";

// Singleton — one pool for the lifetime of the process.
// Next.js hot-reloads in dev can create multiple, so we cache on globalThis.
const globalForDb = globalThis as unknown as { _pgPool?: Pool };

export const db: Pool =
  globalForDb._pgPool ??
  (globalForDb._pgPool = new Pool({
    connectionString: config.db.url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  }));
