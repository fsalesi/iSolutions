import { NextRequest, NextResponse } from "next/server";
/**
 * GET /api/form_toolbar_actions/handlers?form_key=POReq
 *
 * Dynamically imports the customer page (falling back to product page)
 * and returns the keys of its exported buttonHandlers record.
 */
export async function GET(req: NextRequest) {
  const formKey = req.nextUrl.searchParams.get("form_key");
  if (!formKey) return NextResponse.json({ handlers: [] });

  try {
    // Try customer version first, fall back to product
    let mod: any = null;
    try {
      mod = await import(`@customer/forms/${formKey}/Page`);
    } catch {
      try {
        mod = await import(`@/components/forms/${formKey}/Page`);
      } catch {
        return NextResponse.json({ handlers: [] });
      }
    }

    const handlers = mod?.buttonHandlers;
    if (!handlers || typeof handlers !== "object") {
      return NextResponse.json({ handlers: [] });
    }

    const keys = Object.keys(handlers);
    return NextResponse.json({ handlers: keys });
  } catch (err: any) {
    return NextResponse.json({ handlers: [], error: err.message });
  }
}
