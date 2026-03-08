/**
 * Groups — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { NextRequest, NextResponse } from "next/server";
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";
import type { TableMeta } from "@/lib/CrudRoute";
import { db } from "@/lib/db";

type GroupsRow = Record<string, unknown> & {
  group_id?: unknown;
  members?: unknown;
  updated_by?: unknown;
};

export class GroupsRoute extends CrudRoute {
  protected keyFields = ["group_id"];

  constructor() {
    super("groups");
  }

  private normalizeId(value: unknown): string {
    return String(value ?? "").trim();
  }

  private normalizeMemberIds(value: unknown): string[] {
    const toId = (v: unknown): string => {
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        return this.normalizeId(o.value ?? o.member_id ?? o.user_id ?? o.id);
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

  private async loadMembersForGroup(groupId: string): Promise<string[]> {
    if (!groupId) return [];

    const res = await db.query(
      `SELECT gm.member_id
         FROM group_members gm
         JOIN users u ON u.user_id = gm.member_id
        WHERE gm.group_id = $1
          AND COALESCE(gm.is_excluded, false) = false
          AND COALESCE(u.is_active, false) = true
        ORDER BY gm.member_id`,
      [groupId],
    );

    return res.rows.map((r: { member_id: string }) => r.member_id);
  }

  private async syncMembersForGroup(groupId: string, membersInput: unknown, actor: string): Promise<void> {
    if (!groupId) return;

    const memberIds = this.normalizeMemberIds(membersInput);

    await db.query(
      `DELETE FROM group_members
        WHERE group_id = $1
          AND COALESCE(is_excluded, false) = false`,
      [groupId],
    );

    if (memberIds.length === 0) return;

    await db.query(
      `INSERT INTO group_members (group_id, member_id, is_excluded, created_by, updated_by)
       SELECT $2, member, false, $3, $3
         FROM unnest($1::text[]) AS member
       ON CONFLICT (group_id, member_id)
       DO UPDATE SET
         is_excluded = false,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [memberIds, groupId, actor || "SYSTEM"],
    );
  }

  private async finalizeWriteResponse(base: NextResponse, membersInput: unknown): Promise<NextResponse> {
    const payload = await base.json().catch(() => null);
    if (!payload) return base;

    if (!base.ok) {
      return NextResponse.json(payload, { status: base.status });
    }

    const saved = payload as GroupsRow;
    const groupId = this.normalizeId(saved.group_id);

    if (membersInput !== undefined && groupId) {
      const actor = this.normalizeId(saved.updated_by) || "SYSTEM";
      await this.syncMembersForGroup(groupId, membersInput, actor);
    }

    saved.members = groupId ? await this.loadMembersForGroup(groupId) : [];
    return NextResponse.json(saved, { status: base.status });
  }

  async transformRow(row: GroupsRow): Promise<GroupsRow> {
    const groupId = this.normalizeId(row.group_id);
    row.members = groupId ? await this.loadMembersForGroup(groupId) : [];
    return row;
  }

  async transformList(rows: Record<string, any>[], _meta: TableMeta): Promise<Record<string, any>[]> {
    const groupIds = [...new Set(rows.map((r) => this.normalizeId(r.group_id)).filter(Boolean))];

    if (groupIds.length === 0) {
      for (const row of rows) {
        (row as GroupsRow).members = [];
      }
      return rows;
    }

    const membersRes = await db.query(
      `SELECT gm.group_id, gm.member_id
         FROM group_members gm
         JOIN users u ON u.user_id = gm.member_id
        WHERE gm.group_id = ANY($1::text[])
          AND COALESCE(gm.is_excluded, false) = false
          AND COALESCE(u.is_active, false) = true
        ORDER BY gm.group_id, gm.member_id`,
      [groupIds],
    );

    const byGroup = new Map<string, string[]>();
    for (const gm of membersRes.rows as Array<{ group_id: string; member_id: string }>) {
      const id = this.normalizeId(gm.group_id);
      const list = byGroup.get(id) || [];
      list.push(gm.member_id);
      byGroup.set(id, list);
    }

    for (const row of rows) {
      const id = this.normalizeId(row.group_id);
      (row as GroupsRow).members = byGroup.get(id) || [];
    }

    return rows;
  }

  async handlePOST(req: NextRequest): Promise<NextResponse> {
    const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));
    const membersInput = Object.prototype.hasOwnProperty.call(body, "members") ? body.members : undefined;
    const base = await super.handlePOST(req);
    return this.finalizeWriteResponse(base, membersInput);
  }

  async handlePUT(req: NextRequest): Promise<NextResponse> {
    const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));
    const membersInput = Object.prototype.hasOwnProperty.call(body, "members") ? body.members : undefined;
    const base = await super.handlePUT(req);
    return this.finalizeWriteResponse(base, membersInput);
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = GroupsRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/groups/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
