import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

type ColType = "text" | "number" | "boolean" | "date" | "datetime" | "image";

/**
 * GET /api/columns?table=users[&form_key=users]
 * Returns effective field catalog:
 * - physical DB columns (minus system/restricted/password)
 * - custom fields declared in form_layout (properties.custom_field=true)
 * - route/form overrides (restricted/password/key)
 */
const SYSTEM_HIDDEN = new Set([
  "oid",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "custom_fields",
  "photo_type",
]);

const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;

function mapSqlType(dataType: string, udtName: string): ColType {
  const dt = (dataType || "").toLowerCase();
  const udt = (udtName || "").toLowerCase();
  if (udt === "bytea") return "image";
  if (dt.includes("int") || dt.includes("numeric") || dt.includes("float") || dt.includes("double") || dt === "real") return "number";
  if (dt === "boolean") return "boolean";
  if (dt.includes("timestamp")) return "datetime";
  if (dt === "date") return "date";
  return "text";
}

function mapRendererType(renderer: string): ColType {
  const r = String(renderer || "text").toLowerCase();
  if (["number", "numeric", "integer"].includes(r)) return "number";
  if (["checkbox", "toggle", "switch", "boolean"].includes(r)) return "boolean";
  if (r === "date") return "date";
  if (["datetime", "timestamptz"].includes(r)) return "datetime";
  if (r === "image") return "image";
  return "text";
}

function parseArrayFromRouteSource(src: string, field: "restrictedFields" | "passwordFields" | "keyFields"): string[] {
  const rx = new RegExp(`protected\\s+${field}\\s*=\\s*(\\[[^;]*\\])\\s*;`, "m");
  const m = src.match(rx);
  if (!m) return [];
  const literal = m[1].trim();

  // First try strict JSON arrays
  try {
    const parsed = JSON.parse(literal);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
  } catch {
    // fallback below
  }

  // Fallback parser for simple quoted lists
  const out: string[] = [];
  const itemRx = /"([^"]+)"|'([^']+)'/g;
  let mm: RegExpExecArray | null;
  while ((mm = itemRx.exec(literal)) !== null) {
    out.push(mm[1] || mm[2]);
  }
  return out;
}

async function inferFormKey(table: string): Promise<string | null> {
  const r = await db.query(
    `SELECT form_key
       FROM form_tables
      WHERE table_name = $1
        AND is_generated = true
        AND to_be_deleted = false
      ORDER BY is_header DESC, sort_order ASC
      LIMIT 1`,
    [table],
  );
  if (!r.rows.length) return null;
  return String(r.rows[0].form_key || "") || null;
}

async function loadFormOverrides(formKey: string, table: string): Promise<{ restricted: Set<string>; password: Set<string>; keys: Set<string> }> {
  const restricted = new Set<string>();
  const password = new Set<string>();
  const keys = new Set<string>();

  // Metadata-driven overrides
  const ff = await db.query(
    `SELECT field_name, data_type, is_key
       FROM form_fields
      WHERE form_key = $1
        AND table_name = $2
        AND to_be_deleted = false`,
    [formKey, table],
  );
  for (const r of ff.rows) {
    const f = String(r.field_name || "");
    if (!f) continue;
    if (String(r.data_type || "") === "password") password.add(f);
    if (r.is_key === true) keys.add(f);
  }

  // Route-file overrides (restricted/password/key arrays)
  try {
    const routePath = path.join(process.cwd(), "src", "app", "api", "forms", formKey, "route.ts");
    if (fs.existsSync(routePath)) {
      const src = fs.readFileSync(routePath, "utf8");
      for (const f of parseArrayFromRouteSource(src, "restrictedFields")) restricted.add(f);
      for (const f of parseArrayFromRouteSource(src, "passwordFields")) password.add(f);
      for (const f of parseArrayFromRouteSource(src, "keyFields")) keys.add(f);
    }
  } catch {
    // best-effort only
  }

  return { restricted, password, keys };
}

export async function GET(req: NextRequest) {
  const table = String(req.nextUrl.searchParams.get("table") || "").trim();
  if (!table || !SAFE_IDENT.test(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const formKeyParam = String(req.nextUrl.searchParams.get("form_key") || req.nextUrl.searchParams.get("formKey") || "").trim();
  const formKey = formKeyParam || (await inferFormKey(table)) || "";

  const schemaRes = await db.query(
    `SELECT column_name, data_type, udt_name, numeric_scale, is_nullable
       FROM information_schema.columns
      WHERE table_name = $1
        AND table_schema = 'public'
      ORDER BY ordinal_position`,
    [table],
  );

  const overrides = formKey ? await loadFormOverrides(formKey, table) : { restricted: new Set<string>(), password: new Set<string>(), keys: new Set<string>() };

  const byKey = new Map<string, any>();

  for (const r of schemaRes.rows) {
    const key = String(r.column_name || "");
    if (!key) continue;
    if (SYSTEM_HIDDEN.has(key)) continue;
    if (overrides.restricted.has(key) || overrides.password.has(key)) continue;

    const type = mapSqlType(String(r.data_type || ""), String(r.udt_name || ""));
    const col: any = {
      key,
      type,
      nullable: r.is_nullable === "YES",
      keyField: overrides.keys.has(key),
      source: "schema",
    };
    if (type === "number" && r.numeric_scale !== null && r.numeric_scale !== undefined) {
      col.scale = Number(r.numeric_scale);
    }
    byKey.set(key, col);
  }

  // Add custom fields (synthetic keys) from form layout
  if (formKey) {
    const customRes = await db.query(
      `SELECT layout_key, properties
         FROM form_layout
        WHERE form_key = $1
          AND table_name = $2
          AND layout_type = 'field'`,
      [formKey, table],
    );

    for (const r of customRes.rows) {
      const key = String(r.layout_key || "").trim();
      if (!key) continue;
      if (byKey.has(key)) continue; // real column already exists

      const props = (r.properties || {}) as Record<string, unknown>;
      if (props.custom_field !== true) continue;
      if (props.transient === true) continue;
      if (overrides.restricted.has(key) || overrides.password.has(key)) continue;

      byKey.set(key, {
        key,
        type: mapRendererType(String(props.renderer || "text")),
        nullable: true,
        keyField: overrides.keys.has(key),
        source: "custom",
      });
    }
  }

  return NextResponse.json(Array.from(byKey.values()));
}
