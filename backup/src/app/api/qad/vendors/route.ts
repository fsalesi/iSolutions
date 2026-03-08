import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSystemSetting } from "@/lib/settings";
import { QADProxyError } from "@/lib/qad/proxy";
import {
  listSuppliers,
  listSuppliersMatch,
  getSupplier,
  getSupplierEmail,
} from "@/lib/qad/vendor";



/**
 * GET /api/qad/vendors?action=list&search=CDW&domain=DEMO1
 * GET /api/qad/vendors?action=get&code=5004000&domain=DEMO1
 * GET /api/qad/vendors?action=email&code=5004000&domain=DEMO1
 *
 * Vendor lookup endpoints for Lookup components and form cascading.
 */
export async function GET(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const action = params.get("action") || "list";
  const domain = params.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "domain parameter is required" }, { status: 400 });
  }

  try {
    switch (action) {
      case "list": {
        const search = params.get("search") || "";
        if (search.length < 2) {
          return NextResponse.json({ rows: [], total: 0 });
        }
        // Check if site uses contains-match mode
        const useMatch = await getSystemSetting("SUPPLIER_SEARCH_MATCHES", { domain });
        const rows =
          useMatch?.toLowerCase() === "true"
            ? await listSuppliersMatch(search, domain)
            : await listSuppliers(search, domain);
        return NextResponse.json({ rows, total: rows.length });
      }

      case "get": {
        const code = params.get("code");
        if (!code) {
          return NextResponse.json({ error: "code parameter is required" }, { status: 400 });
        }
        const vendor = await getSupplier(code, domain);
        if (!vendor) {
          return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
        }
        return NextResponse.json(vendor);
      }

      case "email": {
        const code = params.get("code");
        if (!code) {
          return NextResponse.json({ error: "code parameter is required" }, { status: 400 });
        }
        const email = await getSupplierEmail(code, domain);
        return NextResponse.json({ email });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use list, get, or email.` },
          { status: 400 }
        );
    }
  } catch (err) {
    if (err instanceof QADProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("QAD vendor error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
