/**
 * Pasoe Brokers — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";

export class PasoeBrokersRoute extends CrudRoute {
  protected keyFields = ["domain"];

  constructor() {
    super("pasoe_brokers");
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = PasoeBrokersRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/pasoe_brokers/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
