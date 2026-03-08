/**
 * RequisitionLines — Product API route (ISS layer).
 * Child table linked to requisition via oid_requisition.
 */
import { CrudRoute, exportRouteHandlers, type ParentBinding } from "@/lib/CrudRoute";

export class RequisitionLinesRoute extends CrudRoute {
  protected keyFields = ["line_number"];

  constructor() {
    super("requisition_lines");
  }

  /**
   * Static parent binding — skips schema query.
   * This table links to requisition via oid_requisition → oid.
   */
  protected getParentBindings(): ParentBinding[] {
    return [
      {
        name: "requisition",
        parentTable: "requisition",
        columns: [{ parentColumn: "oid", childColumn: "oid_requisition" }],
      },
    ];
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = RequisitionLinesRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/requisition_lines/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
