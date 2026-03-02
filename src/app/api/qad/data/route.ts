import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { QADProxyError, getQADData } from "@/lib/qad/proxy";

/**
 * GET /api/qad/data?table=cc_mstr&where=cc_domain eq "demo1"&fields=cc_code,cc_desc&domain=DEMO1&max=50
 *
 * Generic QAD table lookup via getData.p / iBridge.
 * Used for simple reference tables (cost centers, accounts, sites, etc.)
 * that don't need server-side business logic.
 */
export async function GET(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const domain = params.get("domain");
  const table = params.get("table");
  const where = params.get("where");
  const fields = params.get("fields");

  if (!domain) {
    return NextResponse.json({ error: "domain parameter is required" }, { status: 400 });
  }
  if (!table) {
    return NextResponse.json({ error: "table parameter is required" }, { status: 400 });
  }
  if (!where) {
    return NextResponse.json({ error: "where parameter is required" }, { status: 400 });
  }
  if (!fields) {
    return NextResponse.json({ error: "fields parameter is required" }, { status: 400 });
  }

  const max = Math.min(Number(params.get("max") || 100), 500);

  try {
    const rows = await getQADData({
      dsName: table,
      whereClause: where,
      fieldSet: fields,
      numRecords: max,
      domain,
      userId,
    });
    return NextResponse.json({ rows, total: rows.length });
  } catch (err) {
    if (err instanceof QADProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("QAD data error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
