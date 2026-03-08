/**
 * Generic CRUD route factory.
 * Generates GET/POST/PUT/DELETE handlers from a simple config.
 * Every route automatically gets: oid filter, search, advanced filters, sort, pagination.
 * All user-facing messages go through i18n translation.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildFilterWhere, parseOidFilter } from "@/lib/filter-sql";
import { translateMessage, getUserLocale } from "@/lib/translate";

type ColType = "text" | "number" | "boolean" | "date" | "datetime";

export interface CrudRouteConfig {
  table: string;
  columns: string[];
  defaultSort?: string;
  searchColumns?: string[];
  requiredFields?: string[];
  writableFields?: string[];
  transforms?: Record<string, (v: any) => any>;
  uniqueErrorMsg?: (body: any) => string;
}



/** Auto-discover column types from information_schema */
async function discoverColTypes(table: string): Promise<Record<string, ColType>> {
  const res = await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = $1 AND table_schema = 'public'`,
    [table]
  );
  const types: Record<string, ColType> = {};
  for (const r of res.rows) {
    const dt = r.data_type.toLowerCase();
    if (dt.includes("int") || dt.includes("numeric") || dt.includes("float") || dt.includes("double") || dt === "real")
      types[r.column_name] = "number";
    else if (dt === "boolean") types[r.column_name] = "boolean";
    else if (dt.includes("timestamp")) types[r.column_name] = "datetime";
    else if (dt === "date") types[r.column_name] = "date";
    else types[r.column_name] = "text";
  }
  return types;
}

export function createCrudRoutes(cfg: CrudRouteConfig) {
  const allowedCols = new Set([...cfg.columns, "oid", "created_at", "created_by", "updated_at", "updated_by"]);

  function coerceValue(colTypes: Record<string, ColType>, field: string, val: any): any {
    if (val === undefined) return null;
    const ct = colTypes[field];
    if (ct === "datetime" || ct === "date") return val === "" || val === null ? null : val;
    if (ct === "number") { if (val === "" || val === null) return 0; const n = Number(val); return isNaN(n) ? 0 : n; }
    if (ct === "boolean") { if (val === "" || val === null) return false; return !!val; }
    return val ?? '';  // Keep empty strings for NOT NULL DEFAULT '' columns
  }

  const defaultSort = cfg.defaultSort || cfg.columns[0];
  const writable = cfg.writableFields || cfg.columns.filter(
    c => !["id", "oid", "created_at", "created_by", "updated_at", "updated_by"].includes(c)
  );

  function applyTransforms(body: Record<string, any>): Record<string, any> {
    if (!cfg.transforms) return body;
    const out = { ...body };
    for (const [k, fn] of Object.entries(cfg.transforms)) {
      if (k in out) out[k] = fn(out[k]);
    }
    return out;
  }

  // -- Auth guard ----------------------------------------
  function requireAuth(req: NextRequest): string {
    const userId = getCurrentUser(req);
    if (!userId) throw new AuthError();
    return userId;
  }
  class AuthError extends Error { constructor() { super("Authentication required"); } }

  // ── Translation helpers ──────────────────────────────
  async function resolveFieldRequired(field: string, req: NextRequest): Promise<string> {
    try {
      const userId = getCurrentUser(req);
      const locale = await getUserLocale(userId);
      return await translateMessage(locale, "message.field_required", { field });
    } catch {
      return `${field} is required`;
    }
  }

  async function resolveSimpleKey(key: string, fallback: string, req: NextRequest): Promise<string> {
    try {
      const userId = getCurrentUser(req);
      const locale = await getUserLocale(userId);
      const result = await translateMessage(locale, key);
      return result === key ? fallback : result;
    } catch {
      return fallback;
    }
  }

  // ── GET ────────────────────────────────────────────────
  async function GET(req: NextRequest) {
    try {
      requireAuth(req);
      const url = req.nextUrl;
      const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
      const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
      const search = url.searchParams.get("search")?.trim() || "";
      const filtersJson = url.searchParams.get("filters") || "";
      const sortCol = url.searchParams.get("sort") || defaultSort;
      const sortDir = url.searchParams.get("dir") === "desc" ? "DESC" : "ASC";
      const safeSort = allowedCols.has(sortCol) ? sortCol : defaultSort;

      const conditions: string[] = [];
      const params: any[] = [];
      let pi = 1;

      const oidFilter = parseOidFilter(url, pi);
      if (oidFilter) { conditions.push(oidFilter.sql); params.push(...oidFilter.params); pi = oidFilter.nextIdx; }

      if (search && cfg.searchColumns?.length) {
        const searchClauses = cfg.searchColumns.map(c => `"${c}"::text ILIKE $${pi}`).join(" OR ");
        conditions.push(`(${searchClauses})`);
        params.push(`%${search}%`); pi++;
      }

      const colTypes = await discoverColTypes(cfg.table);

      if (filtersJson) {
        const fr = buildFilterWhere(filtersJson, pi, colTypes, allowedCols);
        if (fr.sql) { conditions.push(fr.sql); params.push(...fr.params); pi = fr.nextIdx; }
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const selectCols = [...new Set([...cfg.columns, "oid", "created_at", "created_by", "updated_at", "updated_by"])].map(c => `"${c}"`).join(", ");

      const countR = await db.query(`SELECT COUNT(*)::int AS total FROM ${cfg.table} ${where}`, params);
      const total = countR.rows[0].total;

      const dataR = await db.query(
        `SELECT ${selectCols} FROM ${cfg.table} ${where}
         ORDER BY "${safeSort}" ${sortDir}
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset]
      );

      let rows = dataR.rows;
      return NextResponse.json({ rows, total, offset, limit, requiredFields: cfg.requiredFields || [], searchColumns: cfg.searchColumns || [] });
    } catch (err: any) {
      if (err instanceof AuthError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      console.error(`GET /api/${cfg.table} error:`, err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── POST ───────────────────────────────────────────────
  async function POST(req: NextRequest) {
    try {
      const userId = requireAuth(req);
      let body = await req.json();
      body = applyTransforms(body);

      for (const f of cfg.requiredFields || []) {
        if (!body[f]?.toString().trim()) {
          const msg = await resolveFieldRequired(f, req);
          return NextResponse.json({ error: msg }, { status: 400 });
        }
      }

      const fields = writable.filter(f => f in body);
      // Inject audit user columns
      fields.push("created_by", "updated_by");
      body["created_by"] = userId;
      body["updated_by"] = userId;
      const colTypes = await discoverColTypes(cfg.table);
      const values = fields.map(f => coerceValue(colTypes, f, body[f]));
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");
      const colList = fields.map(f => `"${f}"`).join(", ");

      const res = await db.query(
        `INSERT INTO ${cfg.table} (${colList}) VALUES (${placeholders}) RETURNING *`,
        values
      );

      return NextResponse.json(res.rows[0], { status: 201 });
    } catch (e: any) {
      if (e instanceof AuthError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      if (e.code === "23505" && cfg.uniqueErrorMsg) {
        return NextResponse.json({ error: cfg.uniqueErrorMsg({}) }, { status: 409 });
      }
      console.error(`POST /api/${cfg.table} error:`, e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // ── PUT ────────────────────────────────────────────────
  async function PUT(req: NextRequest) {
    try {
      const userId = requireAuth(req);
      let body = await req.json();
      body = applyTransforms(body);
      const oid = body.oid;
      if (!oid) {
        const msg = await resolveSimpleKey("message.oid_required", "oid is required", req);
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      for (const f of cfg.requiredFields || []) {
        if (f in body && !body[f]?.toString().trim()) {
          const msg = await resolveFieldRequired(f, req);
          return NextResponse.json({ error: msg }, { status: 400 });
        }
      }

      const fields = writable.filter(f => f in body);
      // Inject audit user column
      fields.push("updated_by");
      body["updated_by"] = userId;
      const colTypes = await discoverColTypes(cfg.table);
      const setClauses = fields.map((f, i) => `"${f}" = $${i + 1}`);
      setClauses.push("updated_at = NOW()");
      const values = fields.map(f => coerceValue(colTypes, f, body[f]));
      values.push(oid);

      const res = await db.query(
        `UPDATE ${cfg.table} SET ${setClauses.join(", ")} WHERE oid = $${values.length}::uuid RETURNING *`,
        values
      );
      if (!res.rows.length) {
        const msg = await resolveSimpleKey("message.not_found", "Not found", req);
        return NextResponse.json({ error: msg }, { status: 404 });
      }

      return NextResponse.json(res.rows[0]);
    } catch (e: any) {
      if (e instanceof AuthError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });      if (e.code === "23505" && cfg.uniqueErrorMsg) {
        return NextResponse.json({ error: cfg.uniqueErrorMsg({}) }, { status: 409 });
      }
      console.error(`PUT /api/${cfg.table} error:`, e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // ── DELETE ─────────────────────────────────────────────
  async function DELETE(req: NextRequest) {
    try {
      requireAuth(req);
      const oid = req.nextUrl.searchParams.get("oid");
      if (!oid) {
        const msg = await resolveSimpleKey("message.oid_required", "oid is required", req);
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      await db.query(`DELETE FROM ${cfg.table} WHERE oid = $1::uuid`, [oid]);
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      if (e instanceof AuthError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });      console.error(`DELETE /api/${cfg.table} error:`, e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return { GET, POST, PUT, DELETE };
}
