/**
 * SsoConfig — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";

export class SsoConfigRoute extends CrudRoute {
  protected keyFields = ["provider_id"];

  constructor() {
    super("sso_config");
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = SsoConfigRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/sso_config/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
