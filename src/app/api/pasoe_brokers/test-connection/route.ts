import { NextRequest, NextResponse } from "next/server";
import { callQAD, QADProxyError } from "@/lib/qad/proxy";
import { translateRequest } from "@/lib/i18n/server";

/**
 * POST /api/pasoe_brokers/test-connection
 * Body: { domain: string, name: string }
 * Calls asstatus.p via callQAD. A successful response means the broker is reachable.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const domain = body?.domain as string | undefined;
  const name   = body?.name   as string | undefined;

  if (!domain || !name) {
    return NextResponse.json({ ok: false, message: await translateRequest(req, "api.pasoe_brokers.domain_name_required", "domain and name are required") }, { status: 400 });
  }

  try {
    await callQAD({
      procedure: "asstatus.p",
      entry:     "",
      input:     name,
      domain,
    });

    return NextResponse.json({ ok: true, message: await translateRequest(req, "api.pasoe_brokers.connected", "Connected to broker \"{name}\" ({domain})", { name, domain }) });
  } catch (err) {
    const msg = err instanceof QADProxyError ? err.message : String(err);
    return NextResponse.json({ ok: false, message: msg });
  }
}
