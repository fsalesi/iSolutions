/**
 * Schema Generation Engine
 * Diffs form metadata against actual database schema and produces DDL operations.
 */
import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DdlOp {
  type: "create_table" | "add_column" | "alter_column" | "create_index" | "drop_index" | "create_trigger" | "warning";
  table: string;
  sql: string;
  description: string;
}

interface FormTable {
  table_name: string;
  is_header: boolean;
  parent_table: string;
  has_attachments: boolean;
}

interface FormField {
  table_name: string;
  field_name: string;
  data_type: string;
  max_length: number | null;
  precision: number | null;
  scale: number | null;
  is_nullable: boolean;
  default_value: string;
  is_indexed: boolean;
  is_unique: boolean;
  is_copyable: boolean;
  case_sensitive: boolean;
}

interface DbColumn {
  column_name: string;
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_nullable: string; // "YES" | "NO"
  column_default: string | null;
}

interface DbIndex {
  indexname: string;
  indexdef: string;
}

// ─── Standard field definitions ───────────────────────────────────────────────

const STANDARD_FIELDS: [string, string][] = [
  ["oid",           "uuid PRIMARY KEY DEFAULT gen_random_uuid()"],
  ["domain",        "citext NOT NULL DEFAULT ''"],
  ["created_at",    "timestamptz NOT NULL DEFAULT now()"],
  ["created_by",    "citext NOT NULL DEFAULT ''"],
  ["updated_at",    "timestamptz NOT NULL DEFAULT now()"],
  ["updated_by",    "citext NOT NULL DEFAULT ''"],
  ["custom_fields", "jsonb NOT NULL DEFAULT '{}'"],
];

const HEADER_ONLY_FIELDS: [string, string][] = [
  ["copied_from", "uuid"],
];

const APPROVAL_FIELDS: [string, string][] = [
  ["status",          "citext NOT NULL DEFAULT ''"],
  ["submitted_by",    "citext NOT NULL DEFAULT ''"],
  ["submitted_at",    "timestamptz"],
  ["approved_at",     "timestamptz"],
  ["approved_by",     "citext NOT NULL DEFAULT ''"],
  ["is_change_order", "boolean NOT NULL DEFAULT false"],
];

// All standard field names (for diff — skip these when comparing custom fields)
const ALL_STANDARD_NAMES = new Set([
  ...STANDARD_FIELDS.map(([n]) => n),
  ...HEADER_ONLY_FIELDS.map(([n]) => n),
  ...APPROVAL_FIELDS.map(([n]) => n),
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapDataType(f: FormField): string {
  switch (f.data_type) {
    case "text":
      if (f.case_sensitive) {
        return f.max_length ? `varchar(${f.max_length})` : "text";
      }
      return "citext"; // citext doesn't use length — it's unlimited
    case "integer":   return "integer";
    case "numeric":   return f.precision ? `numeric(${f.precision},${f.scale ?? 0})` : "numeric";
    case "boolean":   return "boolean";
    case "date":      return "date";
    case "timestamptz": return "timestamptz";
    case "uuid":      return "uuid";
    case "jsonb":     return "jsonb";
    default:          return "citext";
  }
}

function defaultClause(f: FormField): string {
  if (f.default_value) return ` DEFAULT ${f.default_value}`;
  // Auto-defaults by type
  switch (f.data_type) {
    case "text":      return " DEFAULT ''";
    case "integer":   return " DEFAULT 0";
    case "numeric":   return " DEFAULT 0";
    case "boolean":   return " DEFAULT false";
    case "jsonb":     return " DEFAULT '{}'";
    default:          return "";
  }
}

function nullClause(f: FormField): string {
  return f.is_nullable ? "" : " NOT NULL";
}

function columnDef(f: FormField): string {
  return `${mapDataType(f)}${nullClause(f)}${defaultClause(f)}`;
}

/** Normalize PG type names for comparison */
function normalizeType(udtName: string, dataType: string, maxLen: number | null, numPrec: number | null, numScale: number | null): string {
  if (udtName === "citext") return "citext";
  if (dataType === "character varying") return maxLen ? `varchar(${maxLen})` : "varchar";
  if (dataType === "text") return "text";
  if (dataType === "integer") return "integer";
  if (dataType === "numeric") return numPrec ? `numeric(${numPrec},${numScale ?? 0})` : "numeric";
  if (dataType === "boolean") return "boolean";
  if (dataType === "date") return "date";
  if (dataType === "timestamp with time zone") return "timestamptz";
  if (dataType === "uuid") return "uuid";
  if (dataType === "jsonb") return "jsonb";
  return udtName || dataType;
}

// ─── CHECK constraint helpers ───
function lenConstraintName(table: string, field: string): string {
  return `chk_${table}_${field}_len`;
}

function needsLenConstraint(f: FormField): boolean {
  return f.data_type === "text" && !f.case_sensitive && !!f.max_length && f.max_length > 0;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateSchema(formKey: string, hasApprovals: boolean): Promise<DdlOp[]> {
  const ops: DdlOp[] = [];

  // 1. Load metadata
  const tablesRes = await db.query(
    `SELECT table_name, is_header, parent_table, has_attachments
     FROM form_tables WHERE form_key = $1 ORDER BY sort_order`,
    [formKey]
  );
  const tables: FormTable[] = tablesRes.rows;

  if (tables.length === 0) throw new Error("No tables defined for this form");

  const fieldsRes = await db.query(
    `SELECT table_name, field_name, data_type, max_length, precision, scale,
            is_nullable, default_value, is_indexed, is_unique, is_copyable, case_sensitive
     FROM form_fields WHERE form_key = $1 ORDER BY table_name, sort_order`,
    [formKey]
  );
  const allFields: FormField[] = fieldsRes.rows;

  // 2. Process each table
  for (const table of tables) {
    const customFields = allFields.filter(f => f.table_name === table.table_name && !f.field_name.startsWith("oid_"));
    const fkFields = allFields.filter(f => f.table_name === table.table_name && f.field_name.startsWith("oid_"));

    // Check if table exists in DB
    const existsRes = await db.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table.table_name]
    );
    const tableExists = existsRes.rows.length > 0;

    if (!tableExists) {
      // ── CREATE TABLE ──
      const cols: string[] = [];

      // Standard fields
      for (const [name, def] of STANDARD_FIELDS) {
        cols.push(`  ${name} ${def}`);
      }

      // Header-only fields
      if (table.is_header) {
        for (const [name, def] of HEADER_ONLY_FIELDS) {
          cols.push(`  ${name} ${def}`);
        }
        // Approval fields
        if (hasApprovals) {
          for (const [name, def] of APPROVAL_FIELDS) {
            cols.push(`  ${name} ${def}`);
          }
        }
      }

      // FK fields (oid_<parent>)
      for (const fk of fkFields) {
        cols.push(`  ${fk.field_name} uuid NOT NULL`);
      }

      // Custom fields
      for (const f of customFields) {
        cols.push(`  ${f.field_name} ${columnDef(f)}`);
      }

      const createSql = `CREATE TABLE ${table.table_name} (\n${cols.join(",\n")}\n)`;
      ops.push({
        type: "create_table",
        table: table.table_name,
        sql: createSql,
        description: `Create table "${table.table_name}"`,
      });

      // Domain index (every table)
      ops.push({
        type: "create_index",
        table: table.table_name,
        sql: `CREATE INDEX idx_${table.table_name}_domain ON ${table.table_name} (domain)`,
        description: `Index on domain`,
      });

      // FK indexes + constraints
      for (const fk of fkFields) {
        const parentTable = fk.field_name.replace(/^oid_/, "");
        ops.push({
          type: "create_index",
          table: table.table_name,
          sql: `CREATE INDEX idx_${table.table_name}_${fk.field_name} ON ${table.table_name} (${fk.field_name})`,
          description: `Index on FK ${fk.field_name}`,
        });
        ops.push({
          type: "create_index", // using create_index type for FK constraint too
          table: table.table_name,
          sql: `ALTER TABLE ${table.table_name} ADD CONSTRAINT fk_${table.table_name}_${fk.field_name} FOREIGN KEY (${fk.field_name}) REFERENCES ${parentTable} (oid) ON DELETE CASCADE`,
          description: `FK constraint ${fk.field_name} → ${parentTable}.oid`,
        });
      }

      // Custom field indexes
      for (const f of customFields) {
        if (f.is_unique) {
          ops.push({
            type: "create_index",
            table: table.table_name,
            sql: `CREATE UNIQUE INDEX uidx_${table.table_name}_${f.field_name} ON ${table.table_name} (${f.field_name})`,
            description: `Unique index on ${f.field_name}`,
          });
        } else if (f.is_indexed) {
          ops.push({
            type: "create_index",
            table: table.table_name,
            sql: `CREATE INDEX idx_${table.table_name}_${f.field_name} ON ${table.table_name} (${f.field_name})`,
            description: `Index on ${f.field_name}`,
          });
        }
      }

      // Length CHECK constraints for citext fields with max_length
      for (const f of customFields) {
        if (needsLenConstraint(f)) {
          ops.push({
            type: "create_index",
            table: table.table_name,
            sql: `ALTER TABLE ${table.table_name} ADD CONSTRAINT ${lenConstraintName(table.table_name, f.field_name)} CHECK (length(${f.field_name}) <= ${f.max_length})`,
            description: `Length constraint on "${f.field_name}" (max ${f.max_length})`,
          });
        }
      }

      // Triggers
      ops.push({
        type: "create_trigger",
        table: table.table_name,
        sql: `CREATE TRIGGER set_updated_at BEFORE UPDATE ON ${table.table_name} FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
        description: `Auto-update updated_at trigger`,
      });
      ops.push({
        type: "create_trigger",
        table: table.table_name,
        sql: `CREATE TRIGGER trg_${table.table_name}_audit AFTER INSERT OR DELETE OR UPDATE ON ${table.table_name} FOR EACH ROW EXECUTE FUNCTION audit_log_notify()`,
        description: `Audit trail trigger`,
      });

    } else {
      // ── ALTER TABLE (table already exists) ──

      // Load existing columns
      const colsRes = await db.query(
        `SELECT column_name, data_type, udt_name, character_maximum_length,
                numeric_precision, numeric_scale, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table.table_name]
      );
      const dbCols = new Map<string, DbColumn>();
      for (const c of colsRes.rows) dbCols.set(c.column_name, c);

      // Load existing indexes
      const idxRes = await db.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
        [table.table_name]
      );
      const dbIndexes = new Map<string, DbIndex>();
      for (const i of idxRes.rows) dbIndexes.set(i.indexname, i);

      // Check for missing custom columns → ADD COLUMN
      for (const f of customFields) {
        if (!dbCols.has(f.field_name)) {
          ops.push({
            type: "add_column",
            table: table.table_name,
            sql: `ALTER TABLE ${table.table_name} ADD COLUMN ${f.field_name} ${columnDef(f)}`,
            description: `Add column "${f.field_name}" (${mapDataType(f)})`,
          });
          // Also add CHECK constraint if needed
          if (needsLenConstraint(f)) {
            ops.push({
              type: "add_column",
              table: table.table_name,
              sql: `ALTER TABLE ${table.table_name} ADD CONSTRAINT ${lenConstraintName(table.table_name, f.field_name)} CHECK (length(${f.field_name}) <= ${f.max_length})`,
              description: `Add length constraint on "${f.field_name}" (max ${f.max_length})`,
            });
          }
        } else {
          // Column exists — check for type mismatch
          const db = dbCols.get(f.field_name)!;
          const metaType = mapDataType(f);
          const dbType = normalizeType(db.udt_name, db.data_type, db.character_maximum_length, db.numeric_precision, db.numeric_scale);
          if (metaType !== dbType) {
            ops.push({
              type: "alter_column",
              table: table.table_name,
              sql: `ALTER TABLE ${table.table_name} ALTER COLUMN ${f.field_name} TYPE ${metaType} USING ${f.field_name}::${metaType}`,
              description: `Change "${f.field_name}" type: ${dbType} → ${metaType}`,
            });
          }
        }
      }

      // Check for approval fields on header
      if (table.is_header && hasApprovals) {
        for (const [name, def] of APPROVAL_FIELDS) {
          if (!dbCols.has(name)) {
            ops.push({
              type: "add_column",
              table: table.table_name,
              sql: `ALTER TABLE ${table.table_name} ADD COLUMN ${name} ${def}`,
              description: `Add approval column "${name}"`,
            });
          }
        }
      }

      // ── Length CHECK constraints diff ──
      // Load existing check constraints for this table
      const chkRes = await db.query(
        `SELECT con.conname, pg_get_constraintdef(con.oid) AS def
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         WHERE rel.relname = $1 AND con.contype = 'c' AND con.conname LIKE 'chk_%_len'`,
        [table.table_name]
      );
      const dbChecks = new Map<string, string>();
      for (const c of chkRes.rows) dbChecks.set(c.conname, c.def);

      for (const f of customFields) {
        const cname = lenConstraintName(table.table_name, f.field_name);
        if (needsLenConstraint(f)) {
          const expectedDef = `CHECK ((length((${f.field_name})::text) <= ${f.max_length}))`;
          if (!dbChecks.has(cname)) {
            // New constraint needed
            ops.push({
              type: "add_column",
              table: table.table_name,
              sql: `ALTER TABLE ${table.table_name} ADD CONSTRAINT ${cname} CHECK (length(${f.field_name}) <= ${f.max_length})`,
              description: `Add length constraint on "${f.field_name}" (max ${f.max_length})`,
            });
          } else if (dbChecks.get(cname) !== expectedDef) {
            // Constraint exists but length changed — drop + recreate in one statement
            ops.push({
              type: "alter_column",
              table: table.table_name,
              sql: `ALTER TABLE ${table.table_name} DROP CONSTRAINT ${cname}, ADD CONSTRAINT ${cname} CHECK (length(${f.field_name}) <= ${f.max_length})`,
              description: `Change length constraint on "${f.field_name}" to max ${f.max_length}`,
            });
          }
          dbChecks.delete(cname); // mark as handled
        } else {
          // Field no longer needs length constraint — drop if exists
          if (dbChecks.has(cname)) {
            ops.push({
              type: "drop_index",
              table: table.table_name,
              sql: `ALTER TABLE ${table.table_name} DROP CONSTRAINT ${cname}`,
              description: `Drop length constraint on "${f.field_name}" (no longer needed)`,
            });
            dbChecks.delete(cname);
          }
        }
      }

      // Check for columns in DB but not in metadata (warnings)
      const metaFieldNames = new Set([
        ...customFields.map(f => f.field_name),
        ...fkFields.map(f => f.field_name),
      ]);
      for (const [colName] of dbCols) {
        if (ALL_STANDARD_NAMES.has(colName)) continue; // standard — skip
        if (colName.startsWith("oid_")) continue; // FK — managed by tables tab
        if (metaFieldNames.has(colName)) continue; // exists in metadata — fine
        ops.push({
          type: "warning",
          table: table.table_name,
          sql: `-- Column "${colName}" exists in DB but not in form metadata`,
          description: `⚠️ Column "${colName}" in "${table.table_name}" is not in metadata (not auto-dropped)`,
        });
      }

      // Index diff
      for (const f of customFields) {
        const idxName = `idx_${table.table_name}_${f.field_name}`;
        const uidxName = `uidx_${table.table_name}_${f.field_name}`;

        if (f.is_unique) {
          if (!dbIndexes.has(uidxName)) {
            // Drop non-unique index if switching to unique
            if (dbIndexes.has(idxName)) {
              ops.push({ type: "drop_index", table: table.table_name, sql: `DROP INDEX IF EXISTS ${idxName}`, description: `Drop non-unique index on ${f.field_name} (switching to unique)` });
            }
            ops.push({ type: "create_index", table: table.table_name, sql: `CREATE UNIQUE INDEX ${uidxName} ON ${table.table_name} (${f.field_name})`, description: `Unique index on ${f.field_name}` });
          }
        } else if (f.is_indexed) {
          if (!dbIndexes.has(idxName)) {
            // Drop unique index if switching to non-unique
            if (dbIndexes.has(uidxName)) {
              ops.push({ type: "drop_index", table: table.table_name, sql: `DROP INDEX IF EXISTS ${uidxName}`, description: `Drop unique index on ${f.field_name} (switching to non-unique)` });
            }
            ops.push({ type: "create_index", table: table.table_name, sql: `CREATE INDEX ${idxName} ON ${table.table_name} (${f.field_name})`, description: `Index on ${f.field_name}` });
          }
        } else {
          // No index wanted — drop if exists
          if (dbIndexes.has(idxName)) {
            ops.push({ type: "drop_index", table: table.table_name, sql: `DROP INDEX IF EXISTS ${idxName}`, description: `Drop index on ${f.field_name}` });
          }
          if (dbIndexes.has(uidxName)) {
            ops.push({ type: "drop_index", table: table.table_name, sql: `DROP INDEX IF EXISTS ${uidxName}`, description: `Drop unique index on ${f.field_name}` });
          }
        }
      }
    }
  }

  return ops;
}

// ─── Execute DDL ──────────────────────────────────────────────────────────────

export async function executeDdl(ops: DdlOp[]): Promise<{ executed: number; warnings: number; errors: string[] }> {
  const errors: string[] = [];
  let executed = 0;
  let warnings = 0;

  for (const op of ops) {
    if (op.type === "warning") {
      warnings++;
      continue;
    }
    try {
      await db.query(op.sql);
      executed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${op.description}: ${msg}`);
    }
  }

  return { executed, warnings, errors };
}
