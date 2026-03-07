/**
 * Default form_layout generator.
 * Auto-populates form_layout rows when Generate runs.
 * Only inserts MISSING rows — never overwrites existing customizations.
 */
import { db } from "@/lib/db";

interface LayoutRow {
  domain: string;
  form_key: string;
  table_name: string;
  layout_type: string;
  layout_key: string;
  parent_key: string;
  sort_order: number;
  properties: Record<string, any>;
}

/** Map data_type → default renderer */
function defaultRenderer(dataType: string): string {
  switch (dataType) {
    case "boolean": return "checkbox";
    case "date": return "date";
    case "timestamptz": return "datetime";
    case "integer": return "number";
    case "numeric": return "number";
    case "uuid": return "text";
    case "jsonb": return "textarea";
    default: return "text";
  }
}

/** Map data_type → default col_span (1 = half width, 2 = full width) */
function defaultColSpan(dataType: string, maxLength: number | null): number {
  if (dataType === "jsonb") return 2;
  if (dataType === "text" && maxLength && maxLength > 100) return 2;
  return 1;
}

function includeInLayout(fieldName: string): boolean {
  if (fieldName.startsWith("oid_")) return false;
  if (fieldName === "custom_fields") return false;
  if (fieldName === "photo_type") return false;
  return true;
}

export async function generateDefaultLayout(formKey: string): Promise<{ inserted: number }> {
  // Load tables + fields
  const tables = await db.query(
    `SELECT table_name, is_header, parent_table, tab_label, sort_order
     FROM form_tables WHERE form_key = $1 ORDER BY sort_order`,
    [formKey]
  );

  const fields = await db.query(
    `SELECT table_name, field_name, data_type, max_length, is_nullable, sort_order
     FROM form_fields WHERE form_key = $1 ORDER BY table_name, sort_order`,
    [formKey]
  );

  // Load existing layout keys to avoid duplicates
  const existing = await db.query(
    `SELECT layout_type, table_name, layout_key
     FROM form_layout WHERE form_key = $1 AND domain = '*'`,
    [formKey]
  );
  const existingKeys = new Set(
    existing.rows.map((r: any) => `${r.layout_type}::${r.table_name}::${r.layout_key}`)
  );

  const toInsert: LayoutRow[] = [];
  const has = (type: string, table: string, key: string) =>
    existingKeys.has(`${type}::${table}::${key}`);

  // Group fields by table
  const fieldsByTable = new Map<string, any[]>();
  for (const f of fields.rows) {
    const list = fieldsByTable.get(f.table_name) || [];
    list.push(f);
    fieldsByTable.set(f.table_name, list);
  }

  const headerTable = tables.rows.find((t: any) => t.is_header);
  const childTables = tables.rows.filter((t: any) => !t.is_header);

  // ── Header table layout ──
  if (headerTable) {
    const tn = headerTable.table_name;

    // Tab: "General"
    if (!has("tab", tn, "general")) {
      toInsert.push({
        domain: "*", form_key: formKey, table_name: tn,
        layout_type: "tab", layout_key: "general", parent_key: "",
        sort_order: 0, properties: { label: "General" },
      });
    }

    // Section: "Details" inside General tab
    if (!has("section", tn, "details")) {
      toInsert.push({
        domain: "*", form_key: formKey, table_name: tn,
        layout_type: "section", layout_key: "details", parent_key: "general",
        sort_order: 0, properties: { label: "Details", columns: 2 },
      });
    }

    // Fields inside Details section
    const headerFields = fieldsByTable.get(tn) || [];
    for (const f of headerFields) {
      // Skip FK fields (oid_*) — they're auto-managed
      if (!includeInLayout(f.field_name)) continue;
      if (!has("field", tn, f.field_name)) {
        toInsert.push({
          domain: "*", form_key: formKey, table_name: tn,
          layout_type: "field", layout_key: f.field_name, parent_key: "details",
          sort_order: f.sort_order,
          properties: {
            renderer: defaultRenderer(f.data_type),
            col_span: defaultColSpan(f.data_type, f.max_length),
            mandatory: !f.is_nullable && f.data_type !== "boolean",
          },
        });
      }
    }

    // Grid columns for header browse grid (first 5 text/number fields)
    const browseFields = headerFields.filter((f: any) => includeInLayout(f.field_name)).slice(0, 6);
    for (const f of browseFields) {
      if (!has("grid_column", tn, f.field_name)) {
        toInsert.push({
          domain: "*", form_key: formKey, table_name: tn,
          layout_type: "grid_column", layout_key: f.field_name, parent_key: "",
          sort_order: f.sort_order,
          properties: {},
        });
      }
    }
  }

  // ── Child table layouts ──
  for (const child of childTables) {
    const tn = child.table_name;
    const childFields = fieldsByTable.get(tn) || [];

    // Tab for child table (on header view)
    if (!has("tab", tn, tn)) {
      toInsert.push({
        domain: "*", form_key: formKey, table_name: tn,
        layout_type: "tab", layout_key: tn, parent_key: "",
        sort_order: child.sort_order + 100, // after header tabs
        properties: { label: child.tab_label || tn.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) },
      });
    }

    // Section inside child tab (for slide-in detail)
    if (!has("section", tn, "details")) {
      toInsert.push({
        domain: "*", form_key: formKey, table_name: tn,
        layout_type: "section", layout_key: "details", parent_key: tn,
        sort_order: 0, properties: { label: "Details", columns: 2 },
      });
    }

    // Fields for child detail form
    for (const f of childFields) {
      if (!includeInLayout(f.field_name)) continue;
      if (!has("field", tn, f.field_name)) {
        toInsert.push({
          domain: "*", form_key: formKey, table_name: tn,
          layout_type: "field", layout_key: f.field_name, parent_key: "details",
          sort_order: f.sort_order,
          properties: {
            renderer: defaultRenderer(f.data_type),
            col_span: defaultColSpan(f.data_type, f.max_length),
            mandatory: !f.is_nullable && f.data_type !== "boolean",
          },
        });
      }
    }

    // Grid columns for child grid (all non-FK fields)
    const gridFields = childFields.filter((f: any) => includeInLayout(f.field_name));
    for (const f of gridFields) {
      if (!has("grid_column", tn, f.field_name)) {
        toInsert.push({
          domain: "*", form_key: formKey, table_name: tn,
          layout_type: "grid_column", layout_key: f.field_name, parent_key: "",
          sort_order: f.sort_order,
          properties: {},
        });
      }
    }
  }

  // ── Insert all missing rows ──
  if (toInsert.length > 0) {
    const values: any[] = [];
    const rows: string[] = [];
    let pi = 1;
    for (const r of toInsert) {
      rows.push(`($${pi}, $${pi+1}, $${pi+2}, $${pi+3}, $${pi+4}, $${pi+5}, $${pi+6}, $${pi+7})`);
      values.push(r.domain, r.form_key, r.table_name, r.layout_type, r.layout_key, r.parent_key, r.sort_order, JSON.stringify(r.properties));
      pi += 8;
    }
    await db.query(
      `INSERT INTO form_layout (domain, form_key, table_name, layout_type, layout_key, parent_key, sort_order, properties)
       VALUES ${rows.join(", ")}
       ON CONFLICT (domain, form_key, layout_type, table_name, layout_key) DO NOTHING`,
      values
    );
  }

  return { inserted: toInsert.length };
}
