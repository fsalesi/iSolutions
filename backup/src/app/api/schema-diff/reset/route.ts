import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { diffFields } from "@/lib/schema-diff";

export async function POST(req: Request) {
  try {
    const { form_key, table_name } = await req.json();

    if (!form_key) {
      return NextResponse.json({ error: "form_key required" }, { status: 400 });
    }

    // If table_name provided, reset just that table
    if (table_name) {
      const fieldDiffs = await diffFields(form_key, table_name);
      
      // Only delete fields that are "New" or "Modified"
      // Preserve "Deleted" fields (intentionally excluded from form)
      const toDelete = fieldDiffs
        .filter(f => f.status === "New" || f.status === "Modified")
        .map(f => f.field_name);

      if (toDelete.length > 0) {
        await db.query(
          `DELETE FROM form_fields
           WHERE form_key = $1 AND table_name = $2 AND field_name = ANY($3)`,
          [form_key, table_name, toDelete]
        );
      }

      return NextResponse.json({
        success: true,
        table_name,
        fields_deleted: toDelete.length,
        message: `Reset table ${table_name}: deleted ${toDelete.length} fields`
      });
    }

    // Reset all tables for this form
    const tablesRes = await db.query(
      `SELECT table_name FROM form_tables WHERE form_key = $1`,
      [form_key]
    );
    const tables = tablesRes.rows.map(r => r.table_name);

    let totalDeleted = 0;
    const results = [];

    for (const tbl of tables) {
      const fieldDiffs = await diffFields(form_key, tbl);
      const toDelete = fieldDiffs
        .filter(f => f.status === "New" || f.status === "Modified")
        .map(f => f.field_name);

      if (toDelete.length > 0) {
        await db.query(
          `DELETE FROM form_fields
           WHERE form_key = $1 AND table_name = $2 AND field_name = ANY($3)`,
          [form_key, tbl, toDelete]
        );
        totalDeleted += toDelete.length;
        results.push({ table: tbl, deleted: toDelete.length });
      }
    }

    // Clear form-level dirty flag after resetting all fields
    await db.query(
      `UPDATE forms SET needs_generate = false WHERE form_key = $1`,
      [form_key]
    );

    return NextResponse.json({
      success: true,
      total_fields_deleted: totalDeleted,
      tables_affected: results,
      form_synced: true,
      message: `Reset form: deleted ${totalDeleted} fields across ${results.length} tables`
    });
  } catch (error: any) {
    console.error("Reset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
