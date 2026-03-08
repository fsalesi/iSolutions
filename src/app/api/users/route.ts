/**
 * Users — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { NextRequest, NextResponse } from "next/server";
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";
import type { TableMeta } from "@/lib/CrudRoute";
import { db } from "@/lib/db";

type UsersRow = Record<string, unknown> & {
  oid?: string;
  user_id?: unknown;
  supervisor_id?: unknown;
  photo?: unknown;
  password_hash?: unknown;
  groups?: unknown;
  updated_by?: unknown;
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

  private normalizeGroupIds(value: unknown): string[] {
    const toId = (v: unknown): string => {
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        return this.normalizeId(o.value ?? o.group_id ?? o.id);
      }
      return this.normalizeId(v);
    };

    let raw: unknown[] = [];
    if (Array.isArray(value)) {
      raw = value;
    } else if (typeof value === "string") {
      raw = value.split(",");
    } else if (value != null) {
      raw = [value];
    }

    const dedup = new Set<string>();
    for (const item of raw) {
      const id = toId(item);
      if (id) dedup.add(id);
    }
    return [...dedup];
  }

  private async loadGroupsForUser(userId: string): Promise<string[]> {
    if (!userId) return [];
    const res = await db.query(
      `SELECT group_id
         FROM group_members
        WHERE member_id = $1
          AND COALESCE(is_excluded, false) = false
        ORDER BY group_id`,
      [userId],
    );
    return res.rows.map((r: { group_id: string }) => r.group_id);
  }

  private async syncGroupsForUser(userId: string, groupsInput: unknown, actor: string): Promise<void> {
    if (!userId) return;

    const groupIds = this.normalizeGroupIds(groupsInput);

    await db.query(
      `DELETE FROM group_members
        WHERE member_id = $1
          AND COALESCE(is_excluded, false) = false`,
      [userId],
    );

    if (groupIds.length === 0) return;

    await db.query(
      `INSERT INTO group_members (group_id, member_id, is_excluded, created_by, updated_by)
       SELECT grp, $2, false, $3, $3
         FROM unnest($1::text[]) AS grp
       ON CONFLICT (group_id, member_id)
       DO UPDATE SET
         is_excluded = false,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [groupIds, userId, actor || "SYSTEM"],
    );
  }

  private async finalizeWriteResponse(base: NextResponse, groupsInput: unknown): Promise<NextResponse> {
    const payload = await base.json().catch(() => null);
    if (!payload) return base;

    if (!base.ok) {
      return NextResponse.json(payload, { status: base.status });
    }

    const saved = payload as UsersRow;
    const userId = this.normalizeId(saved.user_id);

    if (groupsInput !== undefined && userId) {
      const actor = this.normalizeId(saved.updated_by) || "SYSTEM";
      await this.syncGroupsForUser(userId, groupsInput, actor);
    }

    if (userId) {
      saved.groups = await this.loadGroupsForUser(userId);
    } else {
      saved.groups = [];
    }

    this.scrubSensitive(saved);
    return NextResponse.json(saved, { status: base.status });
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

    const userId = this.normalizeId(row.user_id);
    row.groups = userId ? await this.loadGroupsForUser(userId) : [];

    if (row.oid && row.photo === true) {
      row.photo = `/api/blob?table=users&field=photo&oid=${row.oid}`;
    } else if (row.photo !== null && row.photo !== undefined) {
      row.photo = null;
    }

    return row;
  }

  async transformList(rows: Record<string, any>[], _meta: TableMeta): Promise<Record<string, any>[]> {
    const userIds = [...new Set(rows.map((r) => this.normalizeId(r.user_id)).filter(Boolean))];
    if (userIds.length === 0) {
      for (const row of rows) {
        (row as UsersRow).groups = [];
      }
      return rows;
    }

    const groupsRes = await db.query(
      `SELECT member_id, group_id
         FROM group_members
        WHERE member_id = ANY($1::text[])
          AND COALESCE(is_excluded, false) = false
        ORDER BY member_id, group_id`,
      [userIds],
    );

    const byMember = new Map<string, string[]>();
    for (const g of groupsRes.rows as Array<{ member_id: string; group_id: string }>) {
      const id = this.normalizeId(g.member_id);
      const list = byMember.get(id) || [];
      list.push(g.group_id);
      byMember.set(id, list);
    }

    for (const row of rows) {
      const id = this.normalizeId(row.user_id);
      (row as UsersRow).groups = byMember.get(id) || [];
    }

    return rows;
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

  async handlePOST(req: NextRequest): Promise<NextResponse> {
    const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));
    const groupsInput = Object.prototype.hasOwnProperty.call(body, "groups") ? body.groups : undefined;
    const base = await super.handlePOST(req);
    return this.finalizeWriteResponse(base, groupsInput);
  }

  async handlePUT(req: NextRequest): Promise<NextResponse> {
    const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));
    const groupsInput = Object.prototype.hasOwnProperty.call(body, "groups") ? body.groups : undefined;
    const base = await super.handlePUT(req);
    return this.finalizeWriteResponse(base, groupsInput);
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = UsersRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/users/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
