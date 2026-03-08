/**
 * Settings — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";

export class SettingsRoute extends CrudRoute {
  protected keyFields = ["owner", "setting_name", "domain", "form"];

  constructor() {
    super("settings");
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = SettingsRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/settings/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
