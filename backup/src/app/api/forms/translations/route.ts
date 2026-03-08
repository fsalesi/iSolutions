/**
 * Translations — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";

export class TranslationsRoute extends CrudRoute {
  protected keyFields = ["locale", "namespace", "key"];

  constructor() {
    super("translations");
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = TranslationsRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/forms/translations/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
