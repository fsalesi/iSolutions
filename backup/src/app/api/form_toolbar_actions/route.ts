import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const form_key = searchParams.get("form_key");
    const table_name = searchParams.get("table_name");
    if (!form_key || !table_name) {
      return NextResponse.json({ error: "form_key and table_name required" }, { status: 400 });
    }
    const res = await db.query(
      `SELECT * FROM form_toolbar_actions
       WHERE form_key = $1 AND table_name = $2
       ORDER BY sort_order, action_key`,
      [form_key, table_name]
    );
    return NextResponse.json({ rows: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Admin check handled client-side; server trusts authenticated session cookie
    const body = await req.json();
    const { form_key, table_name, action_key, label, icon, variant, separator, is_hidden, sort_order, is_standard, handler } = body;
    const res = await db.query(
      `INSERT INTO form_toolbar_actions
         (form_key, table_name, action_key, label, icon, variant, separator, is_hidden, sort_order, is_standard, handler)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (form_key, table_name, action_key) DO UPDATE SET
         label=$4, icon=$5, variant=$6, separator=$7, is_hidden=$8, sort_order=$9, is_standard=$10, handler=$11, updated_at=now()
       RETURNING *`,
      [form_key, table_name, action_key, label||'', icon||'', variant||'default', separator||false, is_hidden||false, sort_order||10, is_standard||false, handler||'']
    );
    return NextResponse.json(res.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Admin check handled client-side; server trusts authenticated session cookie
    const body = await req.json();
    const { oid, label, icon, variant, separator, is_hidden, sort_order, handler } = body;
    const res = await db.query(
      `UPDATE form_toolbar_actions SET
         label=$2, icon=$3, variant=$4, separator=$5, is_hidden=$6, sort_order=$7, handler=$8, updated_at=now()
       WHERE oid=$1 RETURNING *`,
      [oid, label||'', icon||'', variant||'default', separator||false, is_hidden||false, sort_order||10, handler||'']
    );
    return NextResponse.json(res.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Admin check handled client-side; server trusts authenticated session cookie
    const oid = req.nextUrl.searchParams.get("oid");
    if (!oid) return NextResponse.json({ error: "oid required" }, { status: 400 });
    await db.query(`DELETE FROM form_toolbar_actions WHERE oid=$1`, [oid]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
