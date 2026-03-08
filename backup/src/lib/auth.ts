import { NextRequest } from "next/server";

const COOKIE_NAME = "isolutions-user";

/** Read the current user ID from the session cookie. Returns "" if not logged in. */
export function getCurrentUser(req: NextRequest): string {
  return req.cookies.get(COOKIE_NAME)?.value || "";
}

/** Cookie name — use for set/clear operations in login/logout routes */
export { COOKIE_NAME };
