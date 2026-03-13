/**
 * Forms — Product API route (ISS layer).
 * Extends CrudRoute base class.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";

export class FormsRoute extends CrudRoute {
  protected keyFields = ["form_key"];

  constructor() {
    super("forms");
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = FormsRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/forms/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
