import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { QADProxyError } from "@/lib/qad/proxy";
import { QadConfigService } from "@/lib/qad/QadConfigService";

export async function GET(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const domain = String(params.get('domain') || '').trim();
  const file = String(params.get('file') || 'config.xml').trim();

  if (!domain) {
    return NextResponse.json({ error: 'domain parameter is required' }, { status: 400 });
  }

  try {
    const metadata = await QadConfigService.load(domain, file);
    return NextResponse.json(metadata);
  } catch (err) {
    if (err instanceof QADProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('QAD config error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
