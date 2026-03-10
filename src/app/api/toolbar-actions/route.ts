import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/toolbar-actions?form_key=requisition&table_name=requisition
 * Returns all button overrides for this toolbar context.
 */
export async function GET(req: NextRequest) {
  try {
    const form_key   = req.nextUrl.searchParams.get("form_key");
    const table_name = req.nextUrl.searchParams.get("table_name");
    if (!form_key || !table_name) {
      return NextResponse.json({ error: "form_key and table_name required" }, { status: 400 });
    }
    const res = await db.query(
      `SELECT oid, action_key, label, icon, variant, separator, is_hidden, sort_order, is_standard, handler
       FROM form_toolbar_actions
       WHERE form_key = $1 AND table_name = $2
       ORDER BY sort_order, action_key`,
      [form_key, table_name]
    );
    return NextResponse.json({ rows: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/toolbar-actions
 * Bulk upsert — receives array of button overrides, replaces all for this form+table.
 * Body: { form_key, table_name, buttons: [{ action_key, label, icon, variant, separator, is_hidden, sort_order, is_standard }] }
 */
export async function PUT(req: NextRequest) {
  try {
    const { form_key, table_name, buttons } = await req.json();
    if (!form_key || !table_name || !Array.isArray(buttons)) {
      return NextResponse.json({ error: "form_key, table_name, and buttons[] required" }, { status: 400 });
    }

    // Upsert each button
    for (const b of buttons) {
      await db.query(
        `INSERT INTO form_toolbar_actions
           (form_key, table_name, action_key, label, icon, variant, separator, is_hidden, sort_order, is_standard, handler)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (form_key, table_name, action_key) DO UPDATE SET
           label=$4, icon=$5, variant=$6, separator=$7, is_hidden=$8, sort_order=$9, is_standard=$10, handler=$11, updated_at=now()`,
        [
          form_key, table_name, b.action_key,
          b.label || "", b.icon || "", b.variant || "default",
          b.separator ?? false, b.is_hidden ?? false, b.sort_order ?? 10,
          b.is_standard ?? false, b.handler || "",
        ]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
