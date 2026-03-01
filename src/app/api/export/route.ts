import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ExcelJS from "exceljs";

/**
 * Generic grid-to-Excel export.
 *
 * POST /api/export
 * Body: {
 *   table: string,          // table/view to query (validated whitelist)
 *   columns: { key: string, label: string }[],  // ordered columns to export
 *   search?: string,        // ILIKE filter
 *   searchFields?: string[], // which columns to search
 *   sort?: string,          // sort column
 *   dir?: "asc" | "desc",
 *   domain?: string,        // optional domain filter
 *   filename?: string,      // download filename
 * }
 *
 * Returns: .xlsx file download
 */

// Whitelist of exportable tables/views
const ALLOWED_TABLES: Record<string, { schema: string; domainCol?: string }> = {
  users: { schema: "public" },
  // Add more as needed: requisitions, vendors, etc.
};

// Whitelist of sortable/queryable columns per table
const ALLOWED_COLUMNS: Record<string, Set<string>> = {
  users: new Set([
    "user_id", "full_name", "email", "is_disabled", "domains", "supervisor_id",
    "approval_limit", "title", "company", "city", "state", "phone", "last_login",
    "created_by", "created_at", "delegate_id", "department", "cost_center",
    "country", "postal_code", "fax", "employee_number", "notes", "locale", "timezone",
    "updated_at", "updated_by",
  ]),
};

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

    // Validate table
    const tableDef = ALLOWED_TABLES[table];
    if (!tableDef) {
      return NextResponse.json({ error: `Table "${table}" not allowed` }, { status: 400 });
    }
    const allowedCols = ALLOWED_COLUMNS[table];
    if (!allowedCols) {
      return NextResponse.json({ error: `No columns defined for "${table}"` }, { status: 400 });
    }

    // Validate requested columns
    const validColumns = (columns as { key: string; label: string }[]).filter(
      c => allowedCols.has(c.key)
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
      const validSearchFields = searchFields.filter((f: string) => allowedCols.has(f));
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
    if (sort && allowedCols.has(sort)) {
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
