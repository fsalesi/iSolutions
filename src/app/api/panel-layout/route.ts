import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invalidateCrudMetaCache } from "@/lib/CrudRoute";

type EntryType = "tab" | "section" | "field" | "custom_field" | "child_grid";

const ENTRY_TYPES = new Set<EntryType>(["tab", "section", "field", "custom_field", "child_grid"]);
const CUSTOM_FIELD_TYPES = new Set(["text", "number", "boolean", "date", "datetime", "image"]);
const RESERVED_FIELD_KEYS = new Set([
  "oid",
  "domain",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "custom_fields",
  "password_hash",
]);

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeRow(row: any) {
  return {
    domain: asNonEmptyString(row.domain) || "*",
    form_key: asNonEmptyString(row.form_key),
    panel_key: asNonEmptyString(row.panel_key),
    table_name: asNonEmptyString(row.table_name),
    entry_type: asNonEmptyString(row.entry_type),
    entry_key: asNonEmptyString(row.entry_key),
    parent_key: typeof row.parent_key === "string" ? row.parent_key.trim() : "",
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    settings: isPlainObject(row.settings) ? row.settings : {},
  };
}

function validateRow(row: ReturnType<typeof normalizeRow>): string | null {
  if (!row.form_key || !row.panel_key || !row.table_name) {
    return "form_key, panel_key, and table_name are required";
  }
  if (!ENTRY_TYPES.has(row.entry_type as EntryType)) {
    return `invalid entry_type: ${row.entry_type}`;
  }
  if (!row.entry_key) {
    return "entry_key is required";
  }
  if (!Number.isInteger(row.sort_order)) {
    return "sort_order must be an integer";
  }
  if (!isPlainObject(row.settings)) {
    return "settings must be an object";
  }

  if (row.entry_type === "custom_field") {
    const key = row.entry_key;
    if (!/^[a-z][a-z0-9_]*$/i.test(key)) {
      return "custom_field entry_key must be alphanumeric/underscore and start with a letter";
    }
    if (RESERVED_FIELD_KEYS.has(key.toLowerCase())) {
      return `reserved field name: ${key}`;
    }
    const dataType = asNonEmptyString(row.settings.dataType);
    if (!CUSTOM_FIELD_TYPES.has(dataType)) {
      return `invalid custom_field dataType: ${dataType || "(blank)"}`;
    }
  }

  return null;
}

function validateRows(rows: ReturnType<typeof normalizeRow>[]): string | null {
  const seen = new Set<string>();
  const customFieldKeys = new Set<string>();

  for (const row of rows) {
    const error = validateRow(row);
    if (error) return error;

    const dedupeKey = [row.domain, row.form_key, row.panel_key, row.table_name, row.entry_type, row.entry_key].join("|");
    if (seen.has(dedupeKey)) {
      return `duplicate layout entry: ${row.entry_type}/${row.entry_key}`;
    }
    seen.add(dedupeKey);

    if (row.entry_type === "custom_field") {
      const cfKey = row.entry_key.toLowerCase();
      if (customFieldKeys.has(cfKey)) {
        return `duplicate custom_field key: ${row.entry_key}`;
      }
      customFieldKeys.add(cfKey);
    }
  }

  return null;
}


async function countCustomFieldUsage(tableName: string, fieldKey: string): Promise<number> {
  const res = await db.query(
    `SELECT COUNT(*)::int AS count
       FROM "${tableName}"
      WHERE custom_fields ? $1
        AND COALESCE(NULLIF(BTRIM(custom_fields->>$1), ''), '') <> ''`,
    [fieldKey]
  );
  return Number(res.rows[0]?.count || 0);
}

/**
 * GET /api/panel-layout?form_key=requisition&panel_key=edit&table_name=requisition&domain=*
 * Returns all persisted panel-layout rows for this panel context.
 */
export async function GET(req: NextRequest) {
  try {
    const form_key = req.nextUrl.searchParams.get("form_key");
    const panel_key = req.nextUrl.searchParams.get("panel_key");
    const table_name = req.nextUrl.searchParams.get("table_name");
    const domain = req.nextUrl.searchParams.get("domain") || "*";

    if (!form_key || !panel_key || !table_name) {
      return NextResponse.json({ error: "form_key, panel_key, and table_name required" }, { status: 400 });
    }

    const res = await db.query(
      `SELECT oid, domain, form_key, panel_key, table_name, entry_type, entry_key, parent_key, sort_order, settings, created_at, created_by, updated_at, updated_by
         FROM panel_layout
        WHERE form_key = $1 AND panel_key = $2 AND table_name = $3 AND domain = $4
        ORDER BY entry_type, sort_order, entry_key`,
      [form_key, panel_key, table_name, domain]
    );

    return NextResponse.json({ rows: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/panel-layout
 * Replaces the full saved panel-layout set for a panel context.
 * Body: { domain?, form_key, panel_key, table_name, rows: [{ entry_type, entry_key, parent_key, sort_order, settings }] }
 */
export async function PUT(req: NextRequest) {
  const client = await db.connect();

  try {
    const body = await req.json();
    const domain = asNonEmptyString(body.domain) || "*";
    const form_key = asNonEmptyString(body.form_key);
    const panel_key = asNonEmptyString(body.panel_key);
    const table_name = asNonEmptyString(body.table_name);
    const rowsIn: any[] | null = Array.isArray(body.rows) ? body.rows : null;

    if (!form_key || !panel_key || !table_name || !rowsIn) {
      return NextResponse.json({ error: "domain?, form_key, panel_key, table_name, and rows[] required" }, { status: 400 });
    }

    const rows = rowsIn.map((row: any) => normalizeRow({ ...row, domain, form_key, panel_key, table_name }));
    const validationError = validateRows(rows);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existingRes = await client.query(
      `SELECT entry_key, settings
         FROM panel_layout
        WHERE domain = $1 AND form_key = $2 AND panel_key = $3 AND table_name = $4 AND entry_type = 'custom_field'`,
      [domain, form_key, panel_key, table_name]
    );
    const existingMap = new Map(existingRes.rows.map((row: any) => [String(row.entry_key), row.settings || {}]));
    for (const row of rows.filter(r => r.entry_type === "custom_field")) {
      const existing = existingMap.get(row.entry_key) as Record<string, unknown> | undefined;
      const beforeType = typeof existing?.dataType === "string" ? String(existing.dataType) : "";
      const afterType = typeof row.settings.dataType === "string" ? String(row.settings.dataType) : "";
      if (existing && beforeType && afterType && beforeType !== afterType) {
        const usageCount = await countCustomFieldUsage(table_name, row.entry_key);
        if (usageCount > 0) {
          return NextResponse.json({ error: `Cannot change data type for custom field "${row.entry_key}" because ${usageCount} record(s) already contain a value.` }, { status: 400 });
        }
      }
    }

    await client.query("BEGIN");
    await client.query(
      `DELETE FROM panel_layout
        WHERE domain = $1 AND form_key = $2 AND panel_key = $3 AND table_name = $4`,
      [domain, form_key, panel_key, table_name]
    );

    for (const row of rows) {
      await client.query(
        `INSERT INTO panel_layout
           (domain, form_key, panel_key, table_name, entry_type, entry_key, parent_key, sort_order, settings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          row.domain,
          row.form_key,
          row.panel_key,
          row.table_name,
          row.entry_type,
          row.entry_key,
          row.parent_key,
          row.sort_order,
          JSON.stringify(row.settings),
        ]
      );
    }

    await client.query("COMMIT");
    invalidateCrudMetaCache(form_key, table_name);
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/panel-layout?oid=<uuid>
 * Deletes a single persisted panel-layout row by oid.
 */
export async function DELETE(req: NextRequest) {
  try {
    const oid = req.nextUrl.searchParams.get("oid");
    if (oid) {
      const existing = await db.query(`SELECT form_key, table_name FROM panel_layout WHERE oid = $1`, [oid]);
      await db.query(`DELETE FROM panel_layout WHERE oid = $1`, [oid]);
      if (existing.rows[0]?.form_key && existing.rows[0]?.table_name) {
        invalidateCrudMetaCache(existing.rows[0].form_key, existing.rows[0].table_name);
      }
      return NextResponse.json({ ok: true });
    }

    const domain = req.nextUrl.searchParams.get("domain") || "*";
    const form_key = req.nextUrl.searchParams.get("form_key") || "";
    const panel_key = req.nextUrl.searchParams.get("panel_key") || "";
    const table_name = req.nextUrl.searchParams.get("table_name") || "";
    const entry_type = req.nextUrl.searchParams.get("entry_type") || "";
    const entry_key = req.nextUrl.searchParams.get("entry_key") || "";

    if (!(form_key && panel_key && table_name && entry_type && entry_key)) {
      return NextResponse.json({ error: "oid or domain/form_key/panel_key/table_name/entry_type/entry_key required" }, { status: 400 });
    }

    if (entry_type !== "custom_field") {
      return NextResponse.json({ error: `DELETE by entry_type currently supports only custom_field` }, { status: 400 });
    }

    const usageCount = await countCustomFieldUsage(table_name, entry_key);
    if (usageCount > 0) {
      return NextResponse.json({ error: `Cannot remove custom field "${entry_key}" because ${usageCount} record(s) already contain a value.` }, { status: 400 });
    }

    await db.query(
      `DELETE FROM panel_layout
        WHERE domain = $1 AND form_key = $2 AND panel_key = $3 AND table_name = $4
          AND ((entry_type = 'custom_field' AND entry_key = $5) OR (entry_type = 'field' AND entry_key = $5))`,
      [domain, form_key, panel_key, table_name, entry_key]
    );
    invalidateCrudMetaCache(form_key, table_name);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
