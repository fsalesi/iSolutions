/**
 * EntityEditor2Route - Product API route (ISS layer).
 * Uses metadata tables with native parent OID links.
 * Exposes human-readable parent names and hides OID parent link fields.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";
import { db } from "@/lib/db";
import type { TableMeta } from "@/lib/CrudRoute";

const IDENT_RE = /^[a-z][a-z0-9_]*$/;
const MENU_CATEGORIES = new Set(["admin", "platform", "i18n", "ipurchase", "iapprove"]);
const FIELD_DATA_TYPES = new Set([
  "text",
  "integer",
  "numeric",
  "boolean",
  "date",
  "timestamptz",
  "password",
  "image",
]);
const LAYOUT_TYPES = new Set(["tab", "section", "field", "grid_column", "child_grid"]);

function text(v: unknown): string {
  return String(v ?? "").trim();
}

function assertIdent(v: unknown, label: string): void {
  const s = text(v);
  if (!s) throw new Error(`${label} is required`);
  if (!IDENT_RE.test(s)) throw new Error(`${label} must be lowercase letters, numbers, underscores, starting with a letter`);
}

export class EntityEditor2Route extends CrudRoute {
  protected keyFields = ["form_key"];

  constructor() {
    super("entity_editor2");
  }

  async validate(data: Record<string, unknown>, meta: TableMeta): Promise<void> {
    if (meta.tableName === "forms") {
      if ("form_key" in data) assertIdent(data.form_key, "form_key");
      if ("form_name" in data && !text(data.form_name)) throw new Error("form_name is required");
      const mc = ("menu_category" in data) ? text(data.menu_category).toLowerCase() : "";
      if (mc && !MENU_CATEGORIES.has(mc)) throw new Error(`menu_category must be one of: ${Array.from(MENU_CATEGORIES).join(", ")}`);
      return;
    }

    if (meta.tableName === "form_tables") {
      if ("table_name" in data) assertIdent(data.table_name, "table_name");

      const formKey = text(data.form_key);
      const tableName = text(data.table_name);
      const parentTable = text(data.parent_table);

      if (parentTable && tableName && parentTable === tableName) {
        throw new Error("A table cannot be its own parent");
      }

      if (parentTable) {
        if (!formKey) throw new Error("form_key is required when parent_table is set");
        const parent = await db.query(
          `SELECT 1 FROM form_tables WHERE form_key = $1 AND table_name = $2 LIMIT 1`,
          [formKey, parentTable]
        );
        if (!parent.rows.length) throw new Error(`parent_table \"${parentTable}\" does not exist in this form`);
      }

      const wantsHeader = !parentTable;
      if (wantsHeader && formKey) {
        const oid = text(data.oid);
        const r = await db.query(
          `SELECT 1 FROM form_tables WHERE form_key = $1 AND is_header = true ${oid ? "AND oid <> $2::uuid" : ""} LIMIT 1`,
          oid ? [formKey, oid] : [formKey]
        );
        if (r.rows.length) throw new Error("Only one header table is allowed per form");
      }
      return;
    }

    if (meta.tableName === "form_fields") {
      if ("field_name" in data) assertIdent(data.field_name, "field_name");
      if ("table_name" in data) assertIdent(data.table_name, "table_name");

      const fieldName = text(data.field_name);
      if (fieldName.startsWith("oid_")) {
        throw new Error("oid_* fields are auto-managed foreign keys and cannot be edited here");
      }

      const dataType = text(data.data_type).toLowerCase();
      if ("data_type" in data && !FIELD_DATA_TYPES.has(dataType)) {
        throw new Error(`data_type must be one of: ${Array.from(FIELD_DATA_TYPES).join(", ")}`);
      }
      return;
    }

    if (meta.tableName === "form_layout") {
      const lt = text(data.layout_type).toLowerCase();
      if ("layout_type" in data && lt && !LAYOUT_TYPES.has(lt)) {
        throw new Error(`layout_type must be one of: ${Array.from(LAYOUT_TYPES).join(", ")}`);
      }
    }
  }

  async beforeSave(data: Record<string, unknown>, meta: TableMeta): Promise<Record<string, unknown>> {
    const out = { ...data };

    if (meta.tableName === "forms") {
      if ("form_key" in out) out.form_key = text(out.form_key);
      if ("menu_category" in out) out.menu_category = text(out.menu_category).toLowerCase();
      return out;
    }

    if (meta.tableName === "form_tables") {
      const parentTable = text(out.parent_table);
      out.parent_table = parentTable;
      out.is_header = parentTable.length === 0;
      if (!text(out.tab_label) && text(out.table_name)) out.tab_label = text(out.table_name);
      return out;
    }

    if (meta.tableName === "form_fields") {
      if (out.oid_form_tables && !text(out.table_name)) {
        const r = await db.query(
          `SELECT table_name FROM form_tables WHERE oid = $1::uuid LIMIT 1`,
          [String(out.oid_form_tables)]
        );
        if (r.rows.length) out.table_name = String(r.rows[0].table_name || "");
      }

      const dt = text(out.data_type).toLowerCase();
      if (dt && FIELD_DATA_TYPES.has(dt)) out.data_type = dt;

      if (out.is_key === true) {
        out.is_unique = true;
        out.is_indexed = true;
        out.is_nullable = false;
      }
      if (out.is_unique === true) out.is_indexed = true;

      if (dt !== "text") {
        out.case_sensitive = false;
        out.max_length = null;
      }
      if (dt !== "numeric") {
        out.precision = null;
        out.scale = null;
      }
      if (dt === "password" || dt === "image") {
        out.is_copyable = false;
      }
      return out;
    }

    if (meta.tableName === "form_layout") {
      const props = (out.properties && typeof out.properties === "object") ? { ...out.properties } : out.properties;
      if (props && typeof props === "object") {
        // Backward compatibility for older metadata key.
        if (Array.isArray((props as Record<string, unknown>).select_options) && !Array.isArray((props as Record<string, unknown>).options)) {
          (props as Record<string, unknown>).options = (props as Record<string, unknown>).select_options;
        }
      }
      out.properties = props;
      return out;
    }

    return out;
  }


  async transformRow(row: Record<string, unknown>, meta: TableMeta): Promise<Record<string, unknown>> {
    const out = { ...row };

    if (meta.tableName === "form_tables") {
      let parentName = String(out.parent_table || "").trim();
      if (!parentName && out.oid_parent_table) {
        const r = await db.query(
          `SELECT table_name FROM form_tables WHERE oid = $1::uuid LIMIT 1`,
          [String(out.oid_parent_table)]
        );
        if (r.rows.length) parentName = String(r.rows[0].table_name || "");
      }
      out.parent = parentName;
    } else if (meta.tableName === "form_fields") {
      out.parent = String(out.table_name || "");
    } else if (meta.tableName === "form_layout") {
      out.parent = String(out.table_name || "");
    }

    delete out.oid_forms;
    delete out.oid_parent_table;
    delete out.oid_form_tables;

    return out;
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = EntityEditor2Route;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/forms/entity_editor2/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override - use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
