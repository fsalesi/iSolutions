/**
 * Requisition — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";

export class RequisitionRoute extends CrudRoute {
  protected keyFields = ["req_number"];

  constructor() {
    super("requisition");
  }

  protected virtualColumns() {
    return [
      { key: "created_by_name", label: "Created By", dataType: "string" },
      { key: "vendor_name",     label: "Vendor",     dataType: "string" },
      { key: "buyer_name",      label: "Buyer",      dataType: "string" },
    ];
  }

  protected buildJoins(_tableName: string): string {
    return `LEFT JOIN users AS _creator ON _creator.user_id = requisition.created_by
            LEFT JOIN users AS _buyer   ON _buyer.user_id   = requisition.buyer`;
  }

  protected buildSelectExtras(_tableName: string): string {
    return `, _creator.full_name AS created_by_name, _buyer.full_name AS buyer_name`;
  }

  protected virtualFilterExprs(): Record<string, string> {
    return {
      created_by_name: "_creator.full_name",
      buyer_name:      "_buyer.full_name",
    };
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = RequisitionRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/requisition/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
