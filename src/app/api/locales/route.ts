/**
 * Locales — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";

export class LocalesRoute extends CrudRoute {
  protected keyFields = ["code"];

  constructor() {
    super("locales");
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = LocalesRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/locales/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
