import { db } from "@/lib/db";

export type FieldStatus = "New" | "Modified" | "Deleted" | null;
export type TableStatus = "New" | null;

interface FieldDiff {
  field_name: string;
  status: FieldStatus;
}

interface TableDiff {
  table_name: string;
  status: TableStatus;
  has_dirty_fields?: boolean;
  dirty_field_count?: number;
}

/**
 * Compare form_fields against actual database schema
 * Returns status for each field and any fields that exist in DB but not in metadata
 */
export async function diffFields(formKey: string, tableName: string): Promise<FieldDiff[]> {
  // Get fields from metadata
  const metaRes = await db.query(
    `SELECT field_name, data_type, is_nullable, default_value, precision, scale
     FROM form_fields 
     WHERE form_key = $1 AND table_name = $2 AND to_be_deleted = false
     ORDER BY field_name`,
    [formKey, tableName]
  );
  const metaFields = new Map(metaRes.rows.map(r => [r.field_name, r]));

  // Get fields from actual schema - with full type info
  // For user-defined types (like citext), resolve to their base type
  const schemaRes = await db.query(
    `SELECT 
       c.column_name, 
       COALESCE(t.typname, c.data_type) as data_type,
       c.character_maximum_length,
       c.numeric_precision,
       c.numeric_scale,
       c.is_nullable
     FROM information_schema.columns c
     LEFT JOIN pg_type t ON c.udt_name = t.typname
     WHERE c.table_name = $1 AND c.table_schema = 'public'
     ORDER BY c.column_name`,
    [tableName]
  );
  const schemaFields = new Map(schemaRes.rows.map(r => [r.column_name, r]));

  const result: FieldDiff[] = [];

  // Check each metadata field
  for (const [fieldName, metaField] of metaFields) {
    const schemaField = schemaFields.get(fieldName);
    
    if (!schemaField) {
      result.push({ field_name: fieldName, status: "New" });
    } else if (hasFieldChanged(metaField, schemaField)) {
      result.push({ field_name: fieldName, status: "Modified" });
    } else {
      result.push({ field_name: fieldName, status: null });
    }
  }

  // Check for fields that exist in schema but not in metadata (Deleted)
  for (const [columnName, schemaField] of schemaFields) {
    if (!metaFields.has(columnName)) {
      result.push({ field_name: columnName, status: "Deleted" });
    }
  }

  return result;
}

/**
 * Compare form_tables against actual database schema
 * Includes dirty field information for each table
 * 
 * "Dirty" means fields that are New or Modified (out of sync with DB).
 * "Deleted" fields (in DB but not in metadata) are NOT counted as dirty.
 */
export async function diffTables(formKey: string): Promise<TableDiff[]> {
  // Get tables from metadata
  const metaRes = await db.query(
    `SELECT table_name FROM form_tables WHERE form_key = $1 AND to_be_deleted = false ORDER BY table_name`,
    [formKey]
  );
  const metaTables = new Set(metaRes.rows.map(r => r.table_name));

  // Get tables from actual schema
  const schemaRes = await db.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  const schemaTables = new Set(schemaRes.rows.map(r => r.table_name));

  const result: TableDiff[] = [];

  // Check each metadata table and count dirty fields
  for (const tableName of metaTables) {
    if (!schemaTables.has(tableName)) {
      result.push({ table_name: tableName, status: "New", has_dirty_fields: true, dirty_field_count: 0 });
    } else {
      // Load field diffs for this table to count dirty fields
      const fieldDiffs = await diffFields(formKey, tableName);
      // Only count "New" and "Modified" as dirty, not "Deleted"
      const dirtyFields = fieldDiffs.filter(f => f.status === "New" || f.status === "Modified");
      result.push({
        table_name: tableName,
        status: null,
        has_dirty_fields: dirtyFields.length > 0,
        dirty_field_count: dirtyFields.length
      });
    }
  }

  return result;
}

function hasFieldChanged(metaField: any, schemaField: any): boolean {
  const metaType = normalizeType(metaField.data_type, {
    precision: metaField.precision,
    scale: metaField.scale
  });
  const schemaType = normalizeType(schemaField.data_type, {
    maxLength: schemaField.character_maximum_length,
    precision: schemaField.numeric_precision,
    scale: schemaField.numeric_scale
  });

  if (metaType !== schemaType) {
    return true;
  }

  const metaNullable = metaField.is_nullable !== false;
  const schemaNullable = schemaField.is_nullable === 'YES';
  
  if (metaNullable !== schemaNullable) {
    return true;
  }

  return false;
}

/**
 * Normalize type name to canonical form
 * 
 * Only includes precision/scale for numeric/decimal (which are user-specified).
 * Integer types have built-in precision but we ignore it.
 * Handles: text, citext, varchar, boolean/bool, integer, bigint, numeric, date, uuid, jsonb, timestamp, etc.
 * User-defined types like citext resolve to their base type via pg_type.typname
 */
function normalizeType(type: string, schemaInfo?: { maxLength?: number; precision?: number; scale?: number }): string {
  if (!type) return "";

  type = type.toLowerCase().trim();

  // Handle all text variants
  if (type === "text" || type === "citext" || type === "varchar" || type.includes("character varying")) {
    return "text";
  }

  // Handle boolean variants
  if (type === "boolean" || type === "bool") {
    return "boolean";
  }

  // Handle numeric types - only numeric/decimal have user-specified precision/scale
  // integer, bigint, smallint, int4, int8, int2 have fixed built-in precision we don't track
  if (type === "numeric" || type === "decimal") {
    if (schemaInfo?.precision && schemaInfo?.scale !== null) {
      return `${type}(${schemaInfo.precision},${schemaInfo.scale})`;
    }
    if (schemaInfo?.precision) {
      return `${type}(${schemaInfo.precision})`;
    }
    return type;
  }

  // For integer types (int4, int8, integer, bigint, smallint, int2), ignore the built-in precision
  if (type === "integer" || type === "int4" || type === "int8" || type === "bigint" || type === "smallint" || type === "int2") {
    return "integer";
  }

  // Everything else (date, uuid, jsonb, timestamp, etc.)
  return type;
}
