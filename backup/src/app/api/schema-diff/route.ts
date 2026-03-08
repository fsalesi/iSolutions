import { NextRequest, NextResponse } from "next/server";
import { diffFields, diffTables } from "@/lib/schema-diff";

export async function GET(req: NextRequest) {
  const formKey = req.nextUrl.searchParams.get("form_key");
  const tableName = req.nextUrl.searchParams.get("table_name");

  if (!formKey) {
    return NextResponse.json({ error: "form_key required" }, { status: 400 });
  }

  try {
    if (tableName) {
      // Return field diffs for a specific table
      const diffs = await diffFields(formKey, tableName);
      return NextResponse.json({ fields: diffs });
    } else {
      // Return table diffs for the entire form
      const diffs = await diffTables(formKey);
      return NextResponse.json({ tables: diffs });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
