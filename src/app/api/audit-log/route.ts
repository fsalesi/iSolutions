import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/audit-log?table=users&oid=<uuid>&offset=0&limit=50
 *
 * Returns the change history for a specific record.
 * Dynamically validates that the requested table has an audit trigger attached.
 * Joins to users table to resolve changed_by user IDs to full names.
 */

async function getAuditedTables(): Promise<Set<string>> {
  const res = await db.query(
    `SELECT DISTINCT event_object_table AS tbl
     FROM information_schema.triggers
     WHERE action_statement LIKE '%audit_log_notify%'`
  );
  return new Set(res.rows.map((r: { tbl: string }) => r.tbl));
}

// Simple table name validation: alphanumeric + underscore only
const tableNameRegex = /^[a-z_][a-z0-9_]*$/i;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const table = url.searchParams.get("table")?.trim() || "";
  const oid = url.searchParams.get("oid")?.trim() || "";
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100")));

  if (!table || !oid) {
    return NextResponse.json({ error: "table and oid are required" }, { status: 400 });
  }
  if (!tableNameRegex.test(table)) {
    return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
  }
  if (!uuidRegex.test(oid)) {
    return NextResponse.json({ error: "Invalid oid format" }, { status: 400 });
  }

  // Dynamic whitelist: only tables with audit trigger
  const allowed = await getAuditedTables();
  if (!allowed.has(table)) {
    return NextResponse.json({ error: `Table "${table}" is not audited` }, { status: 400 });
  }

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM audit_log
     WHERE table_name = $1 AND record_oid = $2`,
    [table, oid]
  );

  const dataRes = await db.query(
    `SELECT a.id, a.action, a.field_name, a.old_value, a.new_value,
            a.changed_by, COALESCE(u.full_name, a.changed_by) AS changed_by_name,
            a.changed_at
     FROM audit_log a
     LEFT JOIN users u ON a.changed_by = u.user_id
     WHERE a.table_name = $1 AND a.record_oid = $2
     ORDER BY a.changed_at DESC, a.id DESC
     LIMIT $3 OFFSET $4`,
    [table, oid, limit, offset]
  );

  return NextResponse.json({
    rows: dataRes.rows,
    total: countRes.rows[0].total,
    offset,
    limit,
  });
}
