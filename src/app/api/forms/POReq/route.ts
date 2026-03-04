/**
 * POReq — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";
import type { TableMeta } from "@/lib/CrudRoute";

export class POReqRoute extends CrudRoute {
  constructor() {
    super("POReq");
  }

  // ISS: Add hooks here. Examples:
  //
  // async validate(data: Record<string, any>, meta: TableMeta, userId: string) {
  //   if (!data.vendor_code) throw new Error("Vendor code is required");
  // }
  //
  // async beforeSave(data: Record<string, any>, meta: TableMeta, userId: string, isNew: boolean) {
  //   data.vendor_code = data.vendor_code?.toUpperCase();
  //   return data;
  // }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = POReqRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/forms/POReq/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
