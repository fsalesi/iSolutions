import { NextRequest, NextResponse } from "next/server";
import { getTranslationBundle } from "@/lib/translate";

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") || "en-us";
  const bundle = await getTranslationBundle(locale);

  return NextResponse.json(bundle, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
