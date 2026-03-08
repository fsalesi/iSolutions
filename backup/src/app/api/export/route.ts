import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ExcelJS from "exceljs";

/**
 * Generic grid-to-Excel export.
 *
 * POST /api/export
 * Body: {
 *   table: string,          // table/view to query (validated against information_schema)
 *   columns: { key: string, label: string }[],  // ordered columns to export
 *   search?: string,        // ILIKE filter
 *   searchFields?: string[], // which columns to search
 *   sort?: string,          // sort column
 *   dir?: "asc" | "desc",
 *   filename?: string,      // download filename
 * }
 *
 * Returns: .xlsx file download
 */

// Table name must be simple identifier (letters, digits, underscores)
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/i;

/** Query information_schema for real columns of a table */
async function getTableColumns(table: string): Promise<Set<string>> {
  const res = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(res.rows.map((r: any) => r.column_name));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      table,
      columns,
      search = "",
      searchFields = [],
      sort = "",
      dir = "asc",
      filename = "export",
    } = body;

    // Validate table name format
    if (!table || !SAFE_IDENT.test(table)) {
      return NextResponse.json({ error: `Invalid table name` }, { status: 400 });
    }

    // Validate table exists and get its columns
    const realCols = await getTableColumns(table);
    if (realCols.size === 0) {
      return NextResponse.json({ error: `Table "${table}" not found` }, { status: 400 });
    }

    // Validate requested columns against real schema
    const validColumns = (columns as { key: string; label: string }[]).filter(
      c => SAFE_IDENT.test(c.key) && realCols.has(c.key)
    );
    if (validColumns.length === 0) {
      return NextResponse.json({ error: "No valid columns specified" }, { status: 400 });
    }

    // Build SELECT
    const selectCols = validColumns.map(c => `"${c.key}"`).join(", ");

    // Build WHERE
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (search && searchFields.length > 0) {
      const validSearchFields = searchFields.filter(
        (f: string) => SAFE_IDENT.test(f) && realCols.has(f)
      );
      if (validSearchFields.length > 0) {
        const clauses = validSearchFields.map(
          (f: string) => `"${f}"::text ILIKE $${paramIdx}`
        );
        conditions.push(`(${clauses.join(" OR ")})`);
        params.push(`%${search}%`);
        paramIdx++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Build ORDER BY
    let orderClause = "";
    if (sort && SAFE_IDENT.test(sort) && realCols.has(sort)) {
      const direction = dir === "desc" ? "DESC" : "ASC";
      orderClause = `ORDER BY "${sort}" ${direction}`;
    }

    const sql = `SELECT ${selectCols} FROM "${table}" ${whereClause} ${orderClause}`;
    const result = await db.query(sql, params);

    // Generate Excel
    const wb = new ExcelJS.Workbook();
    wb.creator = "iSolutions";
    wb.created = new Date();

    const ws = ws_create(wb, validColumns, result.rows);

    // Stream response
    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error("POST /api/export error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function ws_create(
  wb: ExcelJS.Workbook,
  columns: { key: string; label: string }[],
  rows: any[]
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet("Export");

  // Header row
  ws.columns = columns.map(col => ({
    header: col.label,
    key: col.key,
    width: Math.max(col.label.length + 4, 14),
  }));

  // Style header
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Arial" };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  // Data rows
  for (const row of rows) {
    const values: any = {};
    for (const col of columns) {
      let val = row[col.key];
      // Format booleans nicely
      if (typeof val === "boolean") val = val ? "Yes" : "No";
      // Format dates
      if (val instanceof Date) val = val.toISOString().split("T")[0];
      values[col.key] = val ?? "";
    }
    ws.addRow(values);
  }

  // Alternate row shading
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    row.font = { size: 10, name: "Arial" };
    if (i % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    }
  }

  // Auto-filter
  if (ws.rowCount > 1) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: ws.rowCount, column: columns.length },
    };
  }

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 1 }];

  return ws;
}
