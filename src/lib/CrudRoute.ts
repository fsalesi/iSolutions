/**
 * CrudRoute — Base class for metadata-driven CRUD route handlers.
 *
 * Three-tier inheritance chain:
 *   CrudRoute (engine) → ProductRoute (ISS) → CustomerRoute (customer)
 *
 * Subclasses override hook methods to add business logic:
 *   validate()      — reject bad data before save
 *   beforeSave()    — mutate data before insert/update
 *   afterSave()     — side effects after successful save
 *   beforeDelete()  — prevent or prepare for deletion
 *   afterDelete()   — cleanup after delete
 *   transformRow()  — modify a single row before returning to client
 *   transformList() — modify the full list before returning to client
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildFilterWhere, parseOidFilter } from "@/lib/filter-sql";

/* ── Types ── */

export type ColType = "text" | "number" | "boolean" | "date" | "datetime";

export interface TableMeta {
  formKey: string;
  tableName: string;
  isHeader: boolean;
  parentTable: string;
  hasApprovals: boolean;
  customFields: FieldMeta[];
  allColumns: string[];
  writableColumns: string[];
  requiredFields: string[];
  searchColumns: string[];
  colTypes: Record<string, ColType>;
  colScales: Record<string, number>;
  defaultSort: string;
}

export interface FieldMeta {
  fieldName: string;
  dataType: string;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
  isNullable: boolean;
  isIndexed: boolean;
  isUnique: boolean;
  caseSensitive: boolean;
}

/* ── Constants ── */

const STANDARD_COLS = [
  "oid", "domain", "created_at", "created_by", "updated_at", "updated_by", "custom_fields",
];
const HEADER_ONLY_COLS = ["copied_from"];
const APPROVAL_COLS = [
  "status", "submitted_by", "submitted_at", "approved_at", "approved_by", "is_change_order",
];

/* ── Metadata cache (shared across all instances) ── */

const metaCache = new Map<string, { meta: TableMeta; loadedAt: number }>();
const CACHE_TTL = 30_000;

/* ── Helpers ── */

function mapColType(dataType: string): ColType {
  switch (dataType) {
    case "integer": return "number";
    case "numeric": return "number";
    case "boolean": return "boolean";
    case "date": return "date";
    case "timestamptz": return "datetime";
    default: return "text";
  }
}

function colScale(f: FieldMeta): number | undefined {
  if (f.dataType === "integer") return 0;
  if (f.dataType === "numeric") return f.scale ?? 2;
  return undefined;
}

function coerceValue(colType: ColType, val: any): any {
  if (val === undefined) return null;
  if (colType === "datetime" || colType === "date") return val === "" || val === null ? null : val;
  if (colType === "number") { if (val === "" || val === null) return 0; const n = Number(val); return isNaN(n) ? 0 : n; }
  if (colType === "boolean") { if (val === "" || val === null) return false; return !!val; }
  return val ?? "";
}

class AuthError extends Error { constructor() { super("Authentication required"); } }

/* ── Load metadata from form_fields + form_tables ── */

async function loadMeta(formKey: string, tableName: string): Promise<TableMeta> {
  const cacheKey = `${formKey}::${tableName}`;
  const cached = metaCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) return cached.meta;

  const tRes = await db.query(
    `SELECT t.is_header, t.parent_table, f.has_approvals
     FROM form_tables t
     JOIN forms f ON f.form_key = t.form_key
     WHERE t.form_key = $1 AND t.table_name = $2`,
    [formKey, tableName]
  );
  if (!tRes.rows.length) throw new Error(`Table "${tableName}" not found in form "${formKey}"`);
  const tRow = tRes.rows[0];

  const fRes = await db.query(
    `SELECT field_name, data_type, max_length, precision, scale, is_nullable, is_indexed, is_unique, case_sensitive
     FROM form_fields
     WHERE form_key = $1 AND table_name = $2
     ORDER BY sort_order, field_name`,
    [formKey, tableName]
  );

  const customFields: FieldMeta[] = fRes.rows.map((r: any) => ({
    fieldName: r.field_name, dataType: r.data_type, maxLength: r.max_length,
    precision: r.precision, scale: r.scale, isNullable: r.is_nullable,
    isIndexed: r.is_indexed, isUnique: r.is_unique, caseSensitive: r.case_sensitive,
  }));

  const customColNames = customFields.map(f => f.fieldName);
  const systemCols = [...STANDARD_COLS];
  if (tRow.is_header) {
    systemCols.push(...HEADER_ONLY_COLS);
    if (tRow.has_approvals) systemCols.push(...APPROVAL_COLS);
  }

  const allColumns = [...systemCols, ...customColNames];
  const writableColumns = customColNames.filter(c => c !== `oid_${tRow.parent_table}`);
  if (tRow.is_header && tRow.has_approvals) {
    writableColumns.push("status", "submitted_by", "submitted_at", "approved_at", "approved_by", "is_change_order");
  }

  const colTypes: Record<string, ColType> = {
    oid: "text", domain: "text", created_at: "datetime", created_by: "text",
    updated_at: "datetime", updated_by: "text", custom_fields: "text",
  };
  const colScales: Record<string, number> = {};

  if (tRow.is_header) {
    colTypes.copied_from = "text";
    if (tRow.has_approvals) {
      colTypes.status = "text"; colTypes.submitted_by = "text";
      colTypes.submitted_at = "datetime"; colTypes.approved_at = "datetime";
      colTypes.approved_by = "text"; colTypes.is_change_order = "boolean";
    }
  }
  for (const f of customFields) {
    colTypes[f.fieldName] = mapColType(f.dataType);
    const s = colScale(f);
    if (s !== undefined) colScales[f.fieldName] = s;
  }

  const requiredFields = customFields.filter(f => !f.isNullable).map(f => f.fieldName);
  const searchColumns = customFields.filter(f => f.dataType === "text").slice(0, 4).map(f => f.fieldName);
  const defaultSort = customFields.find(f => f.isIndexed)?.fieldName || customFields[0]?.fieldName || "created_at";

  const meta: TableMeta = {
    formKey, tableName, isHeader: tRow.is_header, parentTable: tRow.parent_table || "",
    hasApprovals: tRow.has_approvals, customFields, allColumns, writableColumns,
    requiredFields, searchColumns, colTypes, colScales, defaultSort,
  };

  metaCache.set(cacheKey, { meta, loadedAt: Date.now() });
  return meta;
}

/* ════════════════════════════════════════════════════════════════════
   CrudRoute — the base class
   ════════════════════════════════════════════════════════════════════ */

export class CrudRoute {
  public readonly formKey: string;

  constructor(formKey: string) {
    this.formKey = formKey;
  }

  /* ── Overridable hooks ── */

  /** Validate data before POST or PUT. Throw an Error to reject. */
  async validate(_data: Record<string, any>, _meta: TableMeta, _userId: string): Promise<void> {}

  /** Mutate data before insert/update. Return the (possibly modified) data. */
  async beforeSave(data: Record<string, any>, _meta: TableMeta, _userId: string, _isNew: boolean): Promise<Record<string, any>> {
    return data;
  }

  /** Side effects after a successful save. `saved` is the RETURNING row. */
  async afterSave(_saved: Record<string, any>, _meta: TableMeta, _userId: string, _isNew: boolean): Promise<void> {}

  /** Called before delete. Throw an Error to prevent deletion. */
  async beforeDelete(_oid: string, _meta: TableMeta, _userId: string): Promise<void> {}

  /** Cleanup after a successful delete. */
  async afterDelete(_oid: string, _meta: TableMeta, _userId: string): Promise<void> {}

  /** Transform a single row before returning to client (GET single or each row in list). */
  async transformRow(row: Record<string, any>, _meta: TableMeta): Promise<Record<string, any>> {
    return row;
  }

  /** Transform the full row list before returning to client (GET list). */
  async transformList(rows: Record<string, any>[], _meta: TableMeta): Promise<Record<string, any>[]> {
    return rows;
  }

  /* ── Core CRUD (call hooks at the right points) ── */

  protected requireAuth(req: NextRequest): string {
    const userId = getCurrentUser(req);
    if (!userId) throw new AuthError();
    return userId;
  }

  protected async loadMeta(tableName: string): Promise<TableMeta> {
    return loadMeta(this.formKey, tableName);
  }

  /* ── GET ── */

  async handleGET(req: NextRequest): Promise<NextResponse> {
    try {
      this.requireAuth(req);
      const url = req.nextUrl;
      const tableName = url.searchParams.get("table") || "";

      // No table = return form structure
      if (!tableName) {
        const tRes = await db.query(
          `SELECT table_name, is_header, parent_table, tab_label, sort_order
           FROM form_tables WHERE form_key = $1 AND is_generated = true AND to_be_deleted = false ORDER BY sort_order`,
          [this.formKey]
        );
        const headerTable = tRes.rows.find((r: any) => r.is_header)?.table_name || "";
        return NextResponse.json({ tables: tRes.rows, headerTable });
      }

      const meta = await this.loadMeta(tableName);
      const allowedCols = new Set(meta.allColumns);

      const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
      const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
      const search = url.searchParams.get("search")?.trim() || "";
      const filtersJson = url.searchParams.get("filters") || "";
      const sortCol = url.searchParams.get("sort") || meta.defaultSort;
      const sortDir = url.searchParams.get("dir") === "desc" ? "DESC" : "ASC";
      const safeSort = allowedCols.has(sortCol) ? sortCol : meta.defaultSort;

      const conditions: string[] = [];
      const params: any[] = [];
      let pi = 1;

      const domain = url.searchParams.get("domain") || "";
      if (domain) { conditions.push(`"domain" = $${pi}`); params.push(domain); pi++; }

      const parentOid = url.searchParams.get("parentOid") || "";
      if (!meta.isHeader && meta.parentTable && parentOid) {
        const fkCol = `oid_${meta.parentTable}`;
        conditions.push(`"${fkCol}" = $${pi}::uuid`); params.push(parentOid); pi++;
      }

      const oidFilter = parseOidFilter(url, pi);
      if (oidFilter) { conditions.push(oidFilter.sql); params.push(...oidFilter.params); pi = oidFilter.nextIdx; }

      if (search && meta.searchColumns.length) {
        const searchClauses = meta.searchColumns.map(c => `"${c}"::text ILIKE $${pi}`).join(" OR ");
        conditions.push(`(${searchClauses})`); params.push(`%${search}%`); pi++;
      }

      if (filtersJson) {
        const fr = buildFilterWhere(filtersJson, pi, meta.colTypes, allowedCols);
        if (fr.sql) { conditions.push(fr.sql); params.push(...fr.params); pi = fr.nextIdx; }
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const selectCols = meta.allColumns.map(c => `"${c}"`).join(", ");

      const countR = await db.query(`SELECT COUNT(*)::int AS total FROM "${tableName}" ${where}`, params);
      const total = countR.rows[0].total;

      const dataR = await db.query(
        `SELECT ${selectCols} FROM "${tableName}" ${where}
         ORDER BY "${safeSort}" ${sortDir}
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset]
      );

      // Apply transformRow to each row, then transformList to the batch
      let rows = dataR.rows;
      rows = await Promise.all(rows.map((r: Record<string, any>) => this.transformRow(r, meta)));
      rows = await this.transformList(rows, meta);

      return NextResponse.json({
        rows, total, offset, limit,
        requiredFields: meta.requiredFields,
        searchColumns: meta.searchColumns,
      });
    } catch (err: any) {
      if (err instanceof AuthError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      console.error(`GET ${this.formKey} error:`, err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  /* ── POST ── */

  async handlePOST(req: NextRequest): Promise<NextResponse> {
    try {
      const userId = this.requireAuth(req);
      let body = await req.json();
      const tableName = body._table || req.nextUrl.searchParams.get("table") || "";
      if (!tableName) return NextResponse.json({ error: "Missing _table" }, { status: 400 });

      const meta = await this.loadMeta(tableName);

      // Validate required fields
      for (const f of meta.requiredFields) {
        if (!body[f]?.toString().trim()) {
          return NextResponse.json({ error: `${f} is required` }, { status: 400 });
        }
      }

      // Hook: validate
      await this.validate(body, meta, userId);

      // Hook: beforeSave (can mutate data)
      body = await this.beforeSave(body, meta, userId, true);

      // Build insert
      const fields: string[] = [];
      const values: any[] = [];

      fields.push("domain"); values.push(body.domain || "");

      for (const col of meta.writableColumns) {
        if (col in body) {
          fields.push(col);
          values.push(coerceValue(meta.colTypes[col] || "text", body[col]));
        }
      }

      if (!meta.isHeader && meta.parentTable && body[`oid_${meta.parentTable}`]) {
        const fkCol = `oid_${meta.parentTable}`;
        if (!fields.includes(fkCol)) { fields.push(fkCol); values.push(body[fkCol]); }
      }

      fields.push("created_by", "updated_by");
      values.push(userId, userId);

      const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");
      const colList = fields.map(f => `"${f}"`).join(", ");

      const res = await db.query(
        `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders}) RETURNING *`,
        values
      );

      const saved = res.rows[0];

      // Hook: afterSave
      await this.afterSave(saved, meta, userId, true);

      return NextResponse.json(saved, { status: 201 });
    } catch (e: any) {
      if (e instanceof AuthError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      if (e.code === "23505") return NextResponse.json({ error: "Duplicate value — record already exists" }, { status: 409 });
      console.error(`POST ${this.formKey} error:`, e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  /* ── PUT ── */

  async handlePUT(req: NextRequest): Promise<NextResponse> {
    try {
      const userId = this.requireAuth(req);
      let body = await req.json();
      const oid = body.oid;
      if (!oid) return NextResponse.json({ error: "oid is required" }, { status: 400 });

      const tableName = body._table || req.nextUrl.searchParams.get("table") || "";
      if (!tableName) return NextResponse.json({ error: "Missing _table" }, { status: 400 });

      const meta = await this.loadMeta(tableName);

      for (const f of meta.requiredFields) {
        if (f in body && !body[f]?.toString().trim()) {
          return NextResponse.json({ error: `${f} is required` }, { status: 400 });
        }
      }

      // Hook: validate
      await this.validate(body, meta, userId);

      // Hook: beforeSave (can mutate data)
      body = await this.beforeSave(body, meta, userId, false);

      const fields: string[] = [];
      const values: any[] = [];

      for (const col of meta.writableColumns) {
        if (col in body) {
          fields.push(col);
          values.push(coerceValue(meta.colTypes[col] || "text", body[col]));
        }
      }

      fields.push("updated_by"); values.push(userId);

      const setClauses = fields.map((f, i) => `"${f}" = $${i + 1}`);
      setClauses.push("updated_at = NOW()");
      values.push(oid);

      const res = await db.query(
        `UPDATE "${tableName}" SET ${setClauses.join(", ")} WHERE oid = $${values.length}::uuid RETURNING *`,
        values
      );

      if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const saved = res.rows[0];

      // Hook: afterSave
      await this.afterSave(saved, meta, userId, false);

      return NextResponse.json(saved);
    } catch (e: any) {
      if (e instanceof AuthError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      if (e.code === "23505") return NextResponse.json({ error: "Duplicate value — record already exists" }, { status: 409 });
      console.error(`PUT ${this.formKey} error:`, e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  /* ── DELETE ── */

  async handleDELETE(req: NextRequest): Promise<NextResponse> {
    try {
      const userId = this.requireAuth(req);
      const url = req.nextUrl;
      const oid = url.searchParams.get("oid");
      const tableName = url.searchParams.get("table") || "";
      if (!oid) return NextResponse.json({ error: "oid is required" }, { status: 400 });
      if (!tableName) return NextResponse.json({ error: "Missing table" }, { status: 400 });

      const meta = await this.loadMeta(tableName);

      // Hook: beforeDelete
      await this.beforeDelete(oid, meta, userId);

      // Cascade delete children if header
      if (meta.isHeader) {
        const childTables = await db.query(
          `SELECT table_name FROM form_tables WHERE form_key = $1 AND NOT is_header AND is_generated = true AND to_be_deleted = false`,
          [this.formKey]
        );
        for (const child of childTables.rows) {
          await db.query(
            `DELETE FROM "${child.table_name}" WHERE "oid_${tableName}" = $1::uuid`,
            [oid]
          );
        }
      }

      await db.query(`DELETE FROM "${tableName}" WHERE oid = $1::uuid`, [oid]);

      // Hook: afterDelete
      await this.afterDelete(oid, meta, userId);

      return NextResponse.json({ ok: true });
    } catch (e: any) {
      if (e instanceof AuthError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      console.error(`DELETE ${this.formKey} error:`, e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }
}

/* ════════════════════════════════════════════════════════════════════
   exportRouteHandlers — wraps a CrudRoute instance into Next.js
   route handler functions (GET, POST, PUT, DELETE).
   ════════════════════════════════════════════════════════════════════ */

export function exportRouteHandlers(instance: CrudRoute) {
  return {
    GET:    (req: NextRequest) => instance.handleGET(req),
    POST:   (req: NextRequest) => instance.handlePOST(req),
    PUT:    (req: NextRequest) => instance.handlePUT(req),
    DELETE: (req: NextRequest) => instance.handleDELETE(req),
  };
}

/* ── Cache management ── */

export function clearCrudRouteMetaCache(formKey?: string) {
  if (formKey) {
    for (const key of metaCache.keys()) {
      if (key.startsWith(`${formKey}::`)) metaCache.delete(key);
    }
  } else {
    metaCache.clear();
  }
}
