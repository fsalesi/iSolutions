/**
 * CustomerPOReqRoute — Customer API route override.
 * Extends the ISS product route. Customer developers add their logic here.
 * This file is NEVER overwritten by re-generate.
 *
 * Hook methods available to override (call super to chain):
 *   validate(data, meta, userId)          — throw to reject before save
 *   beforeSave(data, meta, userId, isNew) — mutate data before insert/update
 *   afterSave(saved, meta, userId, isNew) — side effects after save
 *   beforeDelete(oid, meta, userId)       — throw to prevent deletion
 *   afterDelete(oid, meta, userId)        — cleanup after delete
 *   transformRow(row, meta)               — modify row before returning to client
 *   transformList(rows, meta)             — modify list before returning to client
 */
import { POReqRoute } from "@/app/api/forms/POReq/route";
// import type { TableMeta } from "@/lib/CrudRoute";

export default class CustomerPOReqRoute extends POReqRoute {
  // Customer: Add overrides here. Examples:
  //
  // async validate(data: Record<string, any>, meta: TableMeta, userId: string) {
  //   await super.validate(data, meta, userId); // chain to ISS logic first
  //   if (data.amount > 50000) throw new Error("Requires executive approval");
  // }
}
