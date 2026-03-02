/**
 * Generic CRUD route factory.
 * Generates GET/POST/PUT/DELETE handlers from a simple config.
 * Every route automatically gets: oid filter, search, advanced filters, sort, pagination.
 * Hooks: Product hooks (src/lib/hooks/) + customer hooks (custom/hooks/) run on save/delete.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildFilterWhere, parseOidFilter } from "@/lib/filter-sql";
import { getHooks, ValidationError } from "@/lib/hooks";

type ColType = "text" | "number" | "boolean" | "date" | "datetime";

export interface CrudRouteConfig {
  table: string;
  /** Columns included in SELECT (also defines allowed filter/sort columns) */
  columns: string[];
  /** Column type overrides (default: "text") */
  colTypes?: Record<string, ColType>;
  /** Default sort column */
  defaultSort?: string;
  /** Columns searched by ?search= (ILIKE). If omitted, search is disabled. */
  searchColumns?: string[];
  /** Required fields for POST/PUT. Validated as non-empty strings. */
  requiredFields?: string[];
  /** Writable fields for POST/PUT (subset of columns). Excludes id, oid, audit cols. */
  writableFields?: string[];
  /** Custom transform for writable values (e.g. toUpperCase on domain) */
  transforms?: Record<string, (v: any) => any>;
  /** Unique constraint error message (for 23505 errors) */
  uniqueErrorMsg?: (body: any) => string;
}

export function createCrudRoutes(cfg: CrudRouteConfig) {
  const allowedCols = new Set([...cfg.columns, "oid", "created_at", "created_by", "updated_at", "updated_by"]);
  const colTypes = cfg.colTypes || {};

  /** Coerce values based on column types before sending to DB */
  function coerceValue(field: string, val: any): any {
    if (val === undefined) return null;
    const ct = colTypes[field];
    if (ct === "datetime" || ct === "date") {
      return val === "" || val === null ? null : val;
    }
    if (ct === "number") {
      if (val === "" || val === null) return 0;
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    }
    if (ct === "boolean") {
      if (val === "" || val === null) return false;
      return !!val;
    }
    return val === "" ? null : val ?? null;
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

  // ── GET ────────────────────────────────────────────────
  async function GET(req: NextRequest) {
    try {
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

      // OID filter (deep link support — automatic for every route)
      const oidFilter = parseOidFilter(url, pi);
      if (oidFilter) { conditions.push(oidFilter.sql); params.push(...oidFilter.params); pi = oidFilter.nextIdx; }

      // Search
      if (search && cfg.searchColumns?.length) {
        const searchClauses = cfg.searchColumns.map(c => `"${c}"::text ILIKE $${pi}`).join(" OR ");
        conditions.push(`(${searchClauses})`);
        params.push(`%${search}%`); pi++;
      }

      // Advanced filters
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

      return NextResponse.json({ rows: dataR.rows, total, offset, limit });
    } catch (err: any) {
      console.error(`GET /api/${cfg.table} error:`, err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── POST ───────────────────────────────────────────────
  async function POST(req: NextRequest) {
    try {
      let body = await req.json();
      body = applyTransforms(body);

      // Validate required fields
      for (const f of cfg.requiredFields || []) {
        if (!body[f]?.toString().trim()) {
          return NextResponse.json({ error: `${f} is required` }, { status: 400 });
        }
      }

      // Run hooks
      const hooks = getHooks(cfg.table);
      if (hooks?.beforeSave) {
        await hooks.beforeSave(body, { db, isNew: true, oid: "", table: cfg.table });
      }

      const fields = writable.filter(f => f in body);
      const values = fields.map(f => coerceValue(f, body[f]));
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");
      const colList = fields.map(f => `"${f}"`).join(", ");

      const res = await db.query(
        `INSERT INTO ${cfg.table} (${colList}) VALUES (${placeholders}) RETURNING *`,
        values
      );

      if (hooks?.afterSave) {
        await hooks.afterSave(body, { db, isNew: true, oid: res.rows[0].oid, table: cfg.table });
      }

      return NextResponse.json(res.rows[0], { status: 201 });
    } catch (e: any) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ error: e.message }, { status: 422 });
      }
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
      let body = await req.json();
      body = applyTransforms(body);
      const oid = body.oid;
      if (!oid) return NextResponse.json({ error: "oid required" }, { status: 400 });

      for (const f of cfg.requiredFields || []) {
        if (!body[f]?.toString().trim()) {
          return NextResponse.json({ error: `${f} is required` }, { status: 400 });
        }
      }

      // Run hooks
      const hooks = getHooks(cfg.table);
      if (hooks?.beforeSave) {
        await hooks.beforeSave(body, { db, isNew: false, oid, table: cfg.table });
      }

      const fields = writable.filter(f => f in body);
      const setClauses = fields.map((f, i) => `"${f}" = $${i + 1}`);
      setClauses.push("updated_at = NOW()");
      const values = fields.map(f => coerceValue(f, body[f]));
      values.push(oid);

      const res = await db.query(
        `UPDATE ${cfg.table} SET ${setClauses.join(", ")} WHERE oid = $${values.length}::uuid RETURNING *`,
        values
      );
      if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

      if (hooks?.afterSave) {
        await hooks.afterSave(body, { db, isNew: false, oid, table: cfg.table });
      }

      return NextResponse.json(res.rows[0]);
    } catch (e: any) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ error: e.message }, { status: 422 });
      }
      if (e.code === "23505" && cfg.uniqueErrorMsg) {
        return NextResponse.json({ error: cfg.uniqueErrorMsg({}) }, { status: 409 });
      }
      console.error(`PUT /api/${cfg.table} error:`, e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // ── DELETE ─────────────────────────────────────────────
  async function DELETE(req: NextRequest) {
    try {
      const oid = req.nextUrl.searchParams.get("oid");
      if (!oid) return NextResponse.json({ error: "oid required" }, { status: 400 });

      // Run hooks
      const hooks = getHooks(cfg.table);
      if (hooks?.beforeDelete) {
        await hooks.beforeDelete(oid, { db, oid, table: cfg.table });
      }

      await db.query(`DELETE FROM ${cfg.table} WHERE oid = $1::uuid`, [oid]);
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ error: e.message }, { status: 422 });
      }
      console.error(`DELETE /api/${cfg.table} error:`, e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return { GET, POST, PUT, DELETE };
}
