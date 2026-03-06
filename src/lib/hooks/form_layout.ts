import type { CrudHooks } from "./types";

const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

const hooks: CrudHooks = {
  async beforeDelete(oid, ctx) {
    const defRes = await ctx.db.query(
      `SELECT form_key, table_name, layout_type, layout_key, properties
         FROM form_layout
        WHERE oid = $1::uuid
        LIMIT 1`,
      [oid],
    );
    if (!defRes.rows.length) return;

    const def = defRes.rows[0] as {
      form_key?: string;
      table_name?: string;
      layout_type?: string;
      layout_key?: string;
      properties?: Record<string, unknown>;
    };

    if (String(def.layout_type || "") !== "field") return;

    const props = (def.properties || {}) as Record<string, unknown>;
    if (props.custom_field !== true) return;

    const tableName = String(def.table_name || "").trim();
    const customKey = String(def.layout_key || "").trim();
    const formKey = String(def.form_key || "").trim();
    if (!tableName || !customKey) return;
    if (!SAFE_IDENT.test(tableName)) return;

    // Keep grid layout in sync: remove stale grid columns for deleted custom field.
    await ctx.db.query(
      `DELETE FROM form_layout
        WHERE layout_type = 'grid_column'
          AND table_name = $1
          AND layout_key = $2
          AND ($3 = '' OR form_key = $3)`,
      [tableName, customKey, formKey],
    );

    // Only clean json bag keys for synthetic fields (not real table columns).
    const realColRes = await ctx.db.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
        LIMIT 1`,
      [tableName, customKey],
    );
    if (realColRes.rows.length > 0) return;

    const cfColRes = await ctx.db.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = 'custom_fields'
        LIMIT 1`,
      [tableName],
    );
    if (!cfColRes.rows.length) return;

    await ctx.db.query(
      `UPDATE ${quoteIdent(tableName)}
          SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) - $1
        WHERE custom_fields ? $1`,
      [customKey],
    );
  },
};

export default hooks;
