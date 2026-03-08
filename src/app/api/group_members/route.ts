/**
 * GroupMembers — API route.
 * group_members is a junction table — no complex business logic needed.
 * Managed primarily through the Users route (which syncs groups on save).
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";

export class GroupMembersRoute extends CrudRoute {
  protected keyFields = ["group_id", "member_id"];

  constructor() {
    super("group_members");
  }
}

// --- Customer override resolution ---
let RouteClass: { new(): CrudRoute } = GroupMembersRoute;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/api/group_members/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
