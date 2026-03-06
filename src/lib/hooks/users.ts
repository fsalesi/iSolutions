import { ValidationError } from "./types";
import type { CrudHooks } from "./types";

const hooks: CrudHooks = {
  async beforeSave(body, ctx) {
    // Stash then strip virtual field — not a real column on users table
    // afterSave reads _groups_raw to sync memberships
    body._groups_raw = body.groups; // may be undefined if not submitted
    delete body.groups;

    // Validate delegate_id is a valid, active, different user
    const delegate = body.delegate_id?.toString().trim();
    if (delegate) {
      const res = await ctx.db.query(
        `SELECT user_id, is_active FROM users WHERE user_id = $1`,
        [delegate]
      );
      if (!res.rows.length) {
        throw new ValidationError("message.delegate_not_exist", { delegate });
      }
      if (!res.rows[0].is_active) {
        throw new ValidationError("message.delegate_inactive", { delegate });
      }
      const userId = body.user_id?.toString().trim();
      if (userId && delegate.toLowerCase() === userId.toLowerCase()) {
        throw new ValidationError("message.delegate_self");
      }
    }
  },

  async afterSave(body, ctx) {
    // Sync group membership when groups virtual field was submitted
    const groupsRaw: string | undefined = body._groups_raw;
    if (groupsRaw === undefined) return;

    const userId = body.user_id?.toString().trim();
    if (!userId) return;

    const submitted = new Set(
      groupsRaw.split(",").map((g: string) => g.trim().toLowerCase()).filter(Boolean)
    );

    const { rows: current } = await ctx.db.query(
      `SELECT group_id, oid FROM group_members WHERE member_id = $1`,
      [userId]
    );
    const currentMap = new Map<string, string>(
      current.map((r: any) => [r.group_id.toLowerCase(), r.oid])
    );

    for (const groupId of submitted) {
      if (!currentMap.has(groupId)) {
        await ctx.db.query(
          `INSERT INTO group_members (group_id, member_id, created_by, updated_by)
           VALUES ($1, $2, $3, $3)
           ON CONFLICT (group_id, member_id) DO NOTHING`,
          [groupId, userId, ctx.oid]
        );
      }
    }

    for (const [groupId, memberOid] of currentMap) {
      if (!submitted.has(groupId)) {
        await ctx.db.query(`DELETE FROM group_members WHERE oid = $1`, [memberOid]);
      }
    }
  },

  async transformRows(rows, db) {
    if (!rows.length) return rows;

    // Batch-load all group memberships for the returned user_ids
    const userIds = rows.map((r: any) => r.user_id).filter(Boolean);
    const { rows: members } = await db.query(
      `SELECT member_id, group_id FROM group_members WHERE member_id = ANY($1)`,
      [userIds]
    );

    // Build map: user_id.lower → comma-separated group_ids
    const map = new Map<string, string[]>();
    for (const m of members) {
      const uid = m.member_id.toLowerCase();
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid)!.push(m.group_id);
    }

    return rows.map((r: any) => ({
      ...r,
      groups: (map.get(r.user_id?.toLowerCase()) ?? []).join(","),
    }));
  },
};

export default hooks;
