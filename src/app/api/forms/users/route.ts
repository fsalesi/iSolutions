/**
 * Users — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";
import { db } from "@/lib/db";

type UsersRow = Record<string, unknown> & {
  oid?: string;
  photo?: unknown;
  password_hash?: unknown;
};

export class UsersRoute extends CrudRoute {
  protected passwordFields = ["password_hash"];
  protected keyFields = ["user_id"];

  constructor() {
    super("users");
  }

  private scrubSensitive(row: UsersRow): UsersRow {
    if ("password_hash" in row) delete row.password_hash;
    return row;
  }

  private normalizeId(value: unknown): string {
    return String(value ?? "").trim();
  }

  /**
   * Prevent supervisor cycles:
   * A -> B -> C means C cannot be assigned supervisor A.
   */
  async validate(data: Record<string, any>): Promise<void> {
    const oid = this.normalizeId(data.oid);
    let userId = this.normalizeId(data.user_id);
    let supervisorId = this.normalizeId(data.supervisor_id);

    if (oid && (!userId || !("supervisor_id" in data))) {
      const existing = await db.query(
        `SELECT user_id, supervisor_id FROM users WHERE oid = $1::uuid LIMIT 1`,
        [oid],
      );
      const row = existing.rows[0];
      if (!row) return;
      if (!userId) userId = this.normalizeId(row.user_id);
      if (!("supervisor_id" in data)) supervisorId = this.normalizeId(row.supervisor_id);
    }

    if (!userId || !supervisorId) return;

    if (userId.toLowerCase() === supervisorId.toLowerCase()) {
      throw new Error("Supervisor cannot be the same as the user");
    }

    const target = userId.toLowerCase();
    let current = supervisorId;
    const visited = new Set<string>();

    for (let depth = 0; depth < 200; depth++) {
      const key = current.toLowerCase();
      if (key === target) {
        throw new Error("Invalid supervisor assignment: this creates a circular supervisor chain");
      }
      if (visited.has(key)) {
        throw new Error("Invalid supervisor assignment: supervisor chain already contains a cycle");
      }
      visited.add(key);

      const next = await db.query(
        `SELECT supervisor_id FROM users WHERE user_id = $1 LIMIT 1`,
        [current],
      );
      if (!next.rows.length) break;
      const nextSupervisor = this.normalizeId(next.rows[0].supervisor_id);
      if (!nextSupervisor) break;
      current = nextSupervisor;
    }
  }

  async transformRow(row: UsersRow): Promise<UsersRow> {
    this.scrubSensitive(row);

    if (row.oid && row.photo === true) {
      row.photo = `/api/blob?table=users&field=photo&oid=${row.oid}`;
    } else if (row.photo !== null && row.photo !== undefined) {
      row.photo = null;
    }

    return row;
  }

  async afterSave(saved: UsersRow): Promise<void> {
    this.scrubSensitive(saved);

    const hasPhoto =
      saved.photo === true ||
      (typeof saved.photo === "string" && saved.photo.length > 0) ||
      (Buffer.isBuffer(saved.photo) && saved.photo.length > 0);

    if (saved.oid && hasPhoto) {
      saved.photo = `/api/blob?table=users&field=photo&oid=${saved.oid}`;
    } else {
      saved.photo = null;
    }
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = UsersRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/forms/users/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
