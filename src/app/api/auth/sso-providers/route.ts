import { NextResponse } from "next/server";
import { getSSOState, getProviderConfig, PROVIDER_META } from "@/lib/sso";

export async function GET() {
  const state = await getSSOState();

  if (state.mode === "off") {
    return NextResponse.json({ providers: [], autoRedirect: false });
  }

  if (state.mode === "auto") {
    const config = await getProviderConfig(state.provider);
    if (!config) return NextResponse.json({ providers: [], autoRedirect: false });
    return NextResponse.json({ providers: [], autoRedirect: true, provider: state.provider });
  }

  // mode === "choice" — show buttons for each configured provider
  const providers = (
    await Promise.all(
      state.providers.map(async (id) => {
        const config = await getProviderConfig(id);
        if (!config) return null;
        return { id, label: PROVIDER_META[id]?.label ?? id };
      })
    )
  ).filter(Boolean);

  return NextResponse.json({ providers, autoRedirect: false });
}
