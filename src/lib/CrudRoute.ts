/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
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
import bcrypt from "bcryptjs";

/* ── Types ── */

export type ColType = "text" | "number" | "boolean" | "date" | "datetime" | "image";

export interface TableMeta {
  formKey: string;
  tableName: string;
  isHeader: boolean;
  parentTable: string;
  hasDomain: boolean;
  hasApprovals: boolean;
  customFields: FieldMeta[];
  allColumns: string[];
  writableColumns: string[];
  requiredFields: string[];
  keyFields: string[];
  searchColumns: string[];
  colTypes: Record<string, ColType>;
  colScales: Record<string, number>;
  defaultSort: string;
  customLayoutFields: Record<string, { transient: boolean; type: ColType }>;
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
  hasDefault: boolean;
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
    case "image": return "image";
    default: return "text";
  }
}

function mapRendererToColType(renderer: string): ColType {
  const r = String(renderer || "text").toLowerCase();
  if (["number", "numeric", "integer"].includes(r)) return "number";
  if (["checkbox", "toggle", "switch", "boolean"].includes(r)) return "boolean";
  if (r === "date") return "date";
  if (["datetime", "timestamptz"].includes(r)) return "datetime";
  if (r === "image") return "image";
  return "text";
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

function normalizeComparable(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  return String(val);
}

class AuthError extends Error { constructor() { super("Authentication required"); } }

/* ── Load metadata from form_tables + live table schema ── */

async function loadMeta(formKey: string, tableName: string): Promise<TableMeta> {
  const cacheKey = `${formKey}::${tableName}`;
  const cached = metaCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) return cached.meta;

  const tRes = await db.query(
    `SELECT t.is_header, t.parent_table, t.has_domain, f.has_approvals
     FROM form_tables t
     JOIN forms f ON f.form_key = t.form_key
     WHERE t.form_key = $1 AND t.table_name = $2`,
    [formKey, tableName]
  );
  if (!tRes.rows.length) throw new Error(`Table "${tableName}" not found in form "${formKey}"`);
  const tRow = tRes.rows[0];

  const sRes = await db.query(
    `SELECT
       c.column_name AS field_name,
       CASE
         WHEN c.udt_name IN ('int2', 'int4', 'int8') THEN 'integer'
         WHEN c.udt_name IN ('numeric', 'decimal', 'float4', 'float8') THEN 'numeric'
         WHEN c.udt_name = 'bool' THEN 'boolean'
         WHEN c.udt_name = 'date' THEN 'date'
         WHEN c.udt_name IN ('timestamp', 'timestamptz') THEN 'timestamptz'
         WHEN c.udt_name = 'bytea' THEN 'image'
         ELSE 'text'
       END AS data_type,
       c.character_maximum_length AS max_length,
       c.numeric_precision AS precision,
       c.numeric_scale AS scale,
       (c.is_nullable = 'YES') AS is_nullable,
       COALESCE(ix.is_indexed, false) AS is_indexed,
       COALESCE(ix.is_unique, false) AS is_unique,
       (c.udt_name <> 'citext') AS case_sensitive,
       (c.column_default IS NOT NULL) AS has_default
     FROM information_schema.columns c
     LEFT JOIN (
       SELECT
         a.attname AS column_name,
         true AS is_indexed,
         bool_or(i.indisunique) AS is_unique
       FROM pg_class t
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN pg_index i ON i.indrelid = t.oid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
       WHERE n.nspname = 'public' AND t.relname = $1
       GROUP BY a.attname
     ) ix ON ix.column_name = c.column_name
     WHERE c.table_schema = 'public' AND c.table_name = $1
     ORDER BY c.ordinal_position`,
    [tableName]
  );

  // Only include system columns that actually exist on this table
  const actualCols = new Set(sRes.rows.map((r: any) => r.field_name));
  const baseCols = (tRow.has_domain
    ? ["oid", "domain", "created_at", "created_by", "updated_at", "updated_by", "custom_fields"]
    : ["oid", "created_at", "created_by", "updated_at", "updated_by"]).filter((c) => actualCols.has(c));
  const systemCols = [...baseCols];
  if (tRow.is_header) {
    if (actualCols.has("copied_from")) systemCols.push("copied_from");
    if (tRow.has_approvals) systemCols.push(...APPROVAL_COLS.filter((c) => actualCols.has(c)));
  }
  const excluded = new Set(systemCols);

  const customFields: FieldMeta[] = sRes.rows
    .filter((r: any) => !excluded.has(r.field_name))
    .map((r: any) => ({
      fieldName: r.field_name,
      dataType: r.data_type,
      maxLength: r.max_length,
      precision: r.precision,
      scale: r.scale,
      isNullable: r.is_nullable,
      isIndexed: r.is_indexed,
      isUnique: r.is_unique,
      caseSensitive: r.case_sensitive,
      hasDefault: r.has_default,
    }));

  const customColNames = customFields.map((f) => f.fieldName);
  const allColumns = [...systemCols, ...customColNames];
  const writableColumns = customColNames.filter((c) => c !== `oid_${tRow.parent_table}`);
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
      colTypes.status = "text";
      colTypes.submitted_by = "text";
      colTypes.submitted_at = "datetime";
      colTypes.approved_at = "datetime";
      colTypes.approved_by = "text";
      colTypes.is_change_order = "boolean";
    }
  }

  for (const f of customFields) {
    colTypes[f.fieldName] = mapColType(f.dataType);
    const s = colScale(f);
    if (s !== undefined) colScales[f.fieldName] = s;
  }

  const requiredFields = customFields.filter((f) => !f.isNullable && !f.hasDefault && f.dataType !== "boolean").map((f) => f.fieldName);
  const searchColumns = customFields.filter((f) => f.dataType === "text").slice(0, 4).map((f) => f.fieldName);
  const defaultSort = customFields.find((f) => f.isIndexed)?.fieldName || customFields[0]?.fieldName || "created_at";

  const layoutRes = await db.query(
    `SELECT layout_key, properties
       FROM form_layout
      WHERE form_key = $1
        AND table_name = $2
        AND layout_type = 'field'`,
    [formKey, tableName]
  );
  const customLayoutFields: Record<string, { transient: boolean; type: ColType }> = {};
  for (const r of layoutRes.rows) {
    const key = String(r.layout_key || "");
    if (!key || allColumns.includes(key)) continue;
    const props = (r.properties || {}) as Record<string, any>;
    if (props.custom_field !== true) continue;
    customLayoutFields[key] = { transient: props.transient === true, type: mapRendererToColType(String(props.renderer || "text")) };
  }

  const meta: TableMeta = {
    formKey,
    tableName,
    isHeader: tRow.is_header,
    parentTable: tRow.parent_table || "",
    hasDomain: tRow.has_domain ?? true,
    hasApprovals: tRow.has_approvals,
    customFields,
    allColumns,
    writableColumns,
    requiredFields,
    keyFields: [],
    searchColumns,
    colTypes,
    colScales,
    defaultSort,
    customLayoutFields,
  };

  metaCache.set(cacheKey, { meta, loadedAt: Date.now() });
  return meta;
}
/* ════════════════════════════════════════════════════════════════════
   CrudRoute — the base class
   ════════════════════════════════════════════════════════════════════ */

export class CrudRoute {
  public readonly formKey: string;

  /**
   * Fields that are never returned in GET responses and never written via POST/PUT.
   * Declare in the generated product route subclass. Inherited by customer routes automatically.
   * Example: protected restrictedFields = ["password_hash", "api_token"];
   */
  protected restrictedFields: string[] = [];

  /**
   * Password fields: excluded from GET responses, and on POST/PUT hashed via bcrypt
   * before writing if non-empty. If the value is empty/absent the field is skipped
   * entirely (never blanks out an existing hash).
   * Declare in the generated product route subclass.
   * Example: protected passwordFields = ["password_hash"];
   */
  protected passwordFields: string[] = [];

  /**
   * Business key fields: required on create and immutable after first save.
   * Declare in generated product route subclass. Example: ["user_id"].
   */
  protected keyFields: string[] = [];

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

  protected normalizeCustomFieldsValue(value: any): Record<string, any> {
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
    return {};
  }

  protected buildCustomFieldPatch(body: Record<string, any>, meta: TableMeta): Record<string, any> {
    const patch: Record<string, any> = {};
    for (const [key, cfg] of Object.entries(meta.customLayoutFields)) {
      if (cfg.transient) continue;
      if (key in body) patch[key] = body[key];
    }
    return patch;
  }

  protected hasCustomFieldPayload(body: Record<string, any>, meta: TableMeta): boolean {
    if ("custom_fields" in body) return true;
    for (const key of Object.keys(meta.customLayoutFields)) {
      if (key in body) return true;
    }
    return false;
  }

  protected mergeCustomFieldsForSave(
    body: Record<string, any>,
    meta: TableMeta,
    existingCustomFields?: any,
  ): Record<string, any> | null {
    if (!meta.allColumns.includes("custom_fields")) return null;
    if (!this.hasCustomFieldPayload(body, meta)) return null;

    const existing = this.normalizeCustomFieldsValue(existingCustomFields);
    const direct = this.normalizeCustomFieldsValue(body.custom_fields);
    const patch = this.buildCustomFieldPatch(body, meta);
    return { ...existing, ...direct, ...patch };
  }

  protected hydrateCustomFieldsIntoRow(row: Record<string, any>, meta: TableMeta): Record<string, any> {
    if (!meta.allColumns.includes("custom_fields")) return row;
    const bag = this.normalizeCustomFieldsValue(row.custom_fields);
    for (const [key, cfg] of Object.entries(meta.customLayoutFields)) {
      if (cfg.transient) continue;
      if (Object.prototype.hasOwnProperty.call(bag, key)) {
        row[key] = bag[key];
      }
    }
    return row;
  }

  protected stripInternalResponseFields(row: Record<string, any>): Record<string, any> {
    delete row.custom_fields;
    for (const f of this.restrictedFields) delete row[f];
    for (const f of this.passwordFields) delete row[f];
    return row;
  }

  /* ── GET ── */

  async handleGET(req: NextRequest): Promise<NextResponse> {
    try {
      this.requireAuth(req);
      const url = req.nextUrl;
      // If no ?table param, default to the header table for this route
      // (allows /api/users?search=x to work without ?table=users)
      let tableName = url.searchParams.get("table") || "";
      if (!tableName) {
        const tRes = await db.query(
          `SELECT table_name, is_header, parent_table, tab_label, sort_order
           FROM form_tables WHERE form_key = $1 AND is_generated = true AND to_be_deleted = false ORDER BY sort_order`,
          [this.formKey]
        );
        const headerTable = tRes.rows.find((r: any) => r.is_header)?.table_name || "";
        // If the caller genuinely wants the form structure (no table found either), return it
        if (!headerTable) return NextResponse.json({ tables: tRes.rows, headerTable });
        tableName = headerTable;
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
      if (meta.hasDomain && domain) { conditions.push(`"domain" = $${pi}`); params.push(domain); pi++; }

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
        const filterColTypes: Record<string, ColType> = { ...meta.colTypes };
        const filterAllowedCols = new Set(allowedCols);
        const filterExpr: Record<string, string> = {};
        for (const [key, cfg] of Object.entries(meta.customLayoutFields)) {
          if (cfg.transient) continue;
          filterAllowedCols.add(key);
          filterColTypes[key] = cfg.type;
          const safeKey = key.replace(/'/g, "''");
          filterExpr[key] = `("custom_fields"->>'${safeKey}')`;
        }
        const fr = buildFilterWhere(filtersJson, pi, filterColTypes, filterAllowedCols, filterExpr);
        if (fr.sql) { conditions.push(fr.sql); params.push(...fr.params); pi = fr.nextIdx; }
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const restricted = new Set([...this.restrictedFields, ...this.passwordFields]);
      // Image fields (bytea): never send binary over the wire — select a boolean
      // presence flag instead. transformRow in the generated route converts to URL.
      const imageFields = new Set(
        Object.entries(meta.colTypes).filter(([, t]) => t === "image").map(([k]) => k)
      );
      const selectCols = meta.allColumns
        .filter(c => !restricted.has(c))
        .map(c => imageFields.has(c)
          ? `(CASE WHEN "${c}" IS NOT NULL AND octet_length("${c}") > 0 THEN true ELSE NULL END) AS "${c}"`
          : `"${c}"`)
        .join(", ");

      const countR = await db.query(`SELECT COUNT(*)::int AS total FROM "${tableName}" ${where}`, params);
      const total = countR.rows[0].total;

      const dataR = await db.query(
        `SELECT ${selectCols} FROM "${tableName}" ${where}
         ORDER BY "${safeSort}" ${sortDir}
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset]
      );

      // Apply transformRow to each row, then transformList to the batch
      let rows = dataR.rows.map((r: Record<string, any>) => this.hydrateCustomFieldsIntoRow(r, meta));
      rows = await Promise.all(rows.map((r: Record<string, any>) => this.transformRow(r, meta)));
      rows = await this.transformList(rows, meta);
      rows = rows.map((r: Record<string, any>) => this.stripInternalResponseFields(r));

      const keyFields = this.keyFields.filter((f) => meta.allColumns.includes(f));

      return NextResponse.json({
        rows, total, offset, limit,
        requiredFields: meta.requiredFields,
        keyFields,
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

      const keyFields = this.keyFields.filter((f) => meta.allColumns.includes(f));
      const requiredOnCreate = Array.from(new Set([...meta.requiredFields, ...keyFields]));

      // Validate required fields (boolean false is valid)
      for (const f of requiredOnCreate) {
        if (meta.colTypes[f] === "boolean") {
          if (!(f in body) || body[f] === null || body[f] === undefined) {
            return NextResponse.json({ error: `${f} is required` }, { status: 400 });
          }
          continue;
        }
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
      const customFieldsMerged = this.mergeCustomFieldsForSave(body, meta);

      if (meta.hasDomain) { fields.push("domain"); values.push(body.domain || ""); }

      for (const col of meta.writableColumns) {
        if (this.restrictedFields.includes(col)) continue;
        if ((meta.colTypes[col] || "text") === "image") continue; // bytea is managed only via /api/blob
        if (this.passwordFields.includes(col)) {
          // Only write if a non-empty value was provided — never blank out an existing hash
          const raw = body[col];
          if (raw && typeof raw === "string" && raw.trim()) {
            fields.push(col);
            values.push(await bcrypt.hash(raw.trim(), 12));
          }
          continue;
        }
        if (col in body) {
          fields.push(col);
          values.push(coerceValue(meta.colTypes[col] || "text", body[col]));
        }
      }

      if (customFieldsMerged !== null) {
        fields.push("custom_fields");
        values.push(customFieldsMerged);
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

      const saved = this.hydrateCustomFieldsIntoRow(res.rows[0], meta);

      // Hook: afterSave
      await this.afterSave(saved, meta, userId, true);
      this.stripInternalResponseFields(saved);

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
      const keyFields = this.keyFields.filter((f) => meta.allColumns.includes(f));
      const hasCustomPayload = this.hasCustomFieldPayload(body, meta);
      let existing: Record<string, any> | null = null;
      if (keyFields.length || hasCustomPayload) {
        const cols = Array.from(new Set([
          ...keyFields,
          ...(hasCustomPayload && meta.allColumns.includes("custom_fields") ? ["custom_fields"] : []),
        ]));
        const selectCols = cols.length ? cols.map((f) => `"${f}"`).join(", ") : `"oid"`;
        const existingR = await db.query(
          `SELECT ${selectCols} FROM "${tableName}" WHERE oid = $1::uuid LIMIT 1`,
          [oid]
        );
        if (!existingR.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
        existing = existingR.rows[0] as Record<string, any>;
      }

      for (const f of meta.requiredFields) {
        if (!(f in body)) continue;
        if (meta.colTypes[f] === "boolean") {
          if (body[f] === null || body[f] === undefined) {
            return NextResponse.json({ error: `${f} is required` }, { status: 400 });
          }
          continue;
        }
        if (!body[f]?.toString().trim()) {
          return NextResponse.json({ error: `${f} is required` }, { status: 400 });
        }
      }

      if (keyFields.length) {
        const existingKeys = existing || {};
        for (const f of keyFields) {
          if (!(f in body)) continue;
          const incoming = normalizeComparable(body[f]);
          const stored = normalizeComparable(existingKeys[f]);
          if (incoming !== stored) {
            return NextResponse.json({ error: `${f} cannot be changed after create` }, { status: 400 });
          }
        }
      }

      // Hook: validate
      await this.validate(body, meta, userId);

      // Hook: beforeSave (can mutate data)
      body = await this.beforeSave(body, meta, userId, false);

      const fields: string[] = [];
      const values: any[] = [];
      const customFieldsMerged = this.mergeCustomFieldsForSave(body, meta, existing?.custom_fields);

      for (const col of meta.writableColumns) {
        if (this.restrictedFields.includes(col)) continue;
        if (keyFields.includes(col)) continue;
        if (col === "custom_fields") continue;
        if ((meta.colTypes[col] || "text") === "image") continue; // bytea is managed only via /api/blob
        if (this.passwordFields.includes(col)) {
          // Only write if a non-empty value was provided — never blank out an existing hash
          const raw = body[col];
          if (raw && typeof raw === "string" && raw.trim()) {
            fields.push(col);
            values.push(await bcrypt.hash(raw.trim(), 12));
          }
          continue;
        }
        if (col in body) {
          fields.push(col);
          values.push(coerceValue(meta.colTypes[col] || "text", body[col]));
        }
      }

      if (customFieldsMerged !== null) {
        fields.push("custom_fields");
        values.push(customFieldsMerged);
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

      const saved = this.hydrateCustomFieldsIntoRow(res.rows[0], meta);

      // Hook: afterSave
      await this.afterSave(saved, meta, userId, false);
      this.stripInternalResponseFields(saved);

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
