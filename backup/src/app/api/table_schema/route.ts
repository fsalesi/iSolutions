/**
 * /api/table_schema?tables=requisition,requisition_lines
 * Returns actual database schema from information_schema, not design-time metadata.
 * This is what runtime FormPage should use instead of form_fields.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface ColumnInfo {
  field_name: string;
  data_type: string;
  scale?: number;
  is_nullable: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const tablesParam = req.nextUrl.searchParams.get("tables");
    if (!tablesParam) {
      return NextResponse.json(
        { error: "tables parameter required (comma-separated)" },
        { status: 400 }
      );
    }

    const tableNames = tablesParam.split(",").map((t) => t.trim());
    if (tableNames.length === 0) {
      return NextResponse.json({ error: "No tables specified" }, { status: 400 });
    }

    // Query actual schema from information_schema
    const placeholders = tableNames.map((_, i) => `$${i + 1}`).join(",");
    const result = await db.query(
      `SELECT 
        table_name,
        column_name as field_name,
        udt_name,
        data_type,
        numeric_scale as scale,
        is_nullable = 'YES' as is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY(ARRAY[${placeholders}])
      ORDER BY table_name, ordinal_position`,
      tableNames
    );

    // Map PG types to form types (matches schema-generator.ts logic)
    const rows = result.rows.map((col: any) => {
      let formType = "text";
      switch (col.udt_name) {
        case "int4":
          formType = "integer";
          break;
        case "numeric":
          formType = "numeric";
          break;
        case "bool":
          formType = "boolean";
          break;
        case "date":
          formType = "date";
          break;
        case "timestamptz":
          formType = "timestamptz";
          break;
        case "uuid":
          formType = "uuid";
          break;
        case "jsonb":
          formType = "jsonb";
          break;
        case "citext":
        case "varchar":
        case "text":
          formType = "text";
          break;
      }

      return {
        table_name: col.table_name,
        field_name: col.field_name,
        data_type: formType,
        scale: col.scale,
        is_nullable: col.is_nullable,
      };
    });

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
