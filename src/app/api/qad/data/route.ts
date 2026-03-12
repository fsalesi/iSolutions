import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { GetDataService } from "@/lib/qad/GetDataService";
import { QADProxyError } from "@/lib/qad/proxy";

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
    const result = await GetDataService.get({
      table,
      whereClause: where,
      fieldSet: fields,
      numRecords: max,
      domain,
      userId,
    });
    return NextResponse.json({ rows: result.rows, total: result.rows.length, dataset: result.dataset });
  } catch (err) {
    if (err instanceof QADProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("QAD data error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const domain = typeof body?.domain === "string" ? body.domain : "";
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const params = {
      table: typeof body?.table === "string" ? body.table : undefined,
      dsName: typeof body?.dsName === "string" ? body.dsName : undefined,
      whereClause: typeof body?.whereClause === "string" ? body.whereClause : undefined,
      fieldSet: body?.fieldSet,
      numRecords: typeof body?.numRecords === "number" ? body.numRecords : undefined,
      domain,
      userId,
      sort: typeof body?.sort === "string" ? body.sort : undefined,
      dir: typeof body?.dir === "string" ? body.dir : undefined,
      restartRowid: typeof body?.restartRowid === "string" ? body.restartRowid : undefined,
      rowid: typeof body?.rowid === "string" ? body.rowid : undefined,
      query: typeof body?.query === "string" ? body.query : undefined,
      queryFields: body?.queryFields,
      filter: typeof body?.filter === "string" ? body.filter : undefined,
      includeSchema: !!body?.includeSchema,
      dictdb: typeof body?.dictdb === "string" ? body.dictdb : undefined,
      reverse: !!body?.reverse,
    };

    const result = await GetDataService.get(params);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof QADProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("QAD data POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
