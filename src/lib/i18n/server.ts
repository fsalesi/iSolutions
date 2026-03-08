import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserLocale, translateMessage } from "@/lib/translate";

export async function getRequestLocale(req: NextRequest): Promise<string> {
  const userId = getCurrentUser(req);
  return getUserLocale(userId);
}

export async function translateRequest(
  req: NextRequest,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): Promise<string> {
  const locale = await getRequestLocale(req);
  return translateMessage(locale, key, params, fallback);
}
