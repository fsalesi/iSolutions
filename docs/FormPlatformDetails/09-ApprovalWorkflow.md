# 9. Approval Workflow

> **PHASE 2** — Build after the Form Platform Core (Phase 1) is complete and stable. The inheritance model (ApprovalFormPage extends FormPage, ApprovalCrudRoute extends CrudRoute) means this snaps on top cleanly without modifying any Phase 1 code.

## Prerequisites (Phase 1)

Before building approvals, the following must be working:
- Entity Designer (tables, fields, relationships)
- Schema generation (CREATE TABLE, ALTER TABLE)
- File generation (page.tsx, route.ts, customer shims)
- FormPage engine (metadata-driven tabs, sections, fields, child grids)
- CrudRoute engine (metadata-driven CRUD with overridable building blocks)
- Screen Layout Designer (design mode, field placement, properties, renderers)
- Copy support (copied_from)

## Scope

### ApprovalFormPage (extends FormPage)
- Status strip at top of form (Status, Requestor, Entry Date)
- Approval History tab (auto-inserted as second tab)
- Field locking rules based on status + ownership
- Button visibility: Submit, Retract, Approve, Reject, Change Order
- editAnytime field flag (fields editable even after approval)

### ApprovalCrudRoute (extends CrudRoute)
- Status lifecycle enforcement
- Submit validation
- Approval action processing (approve, reject, retract, send back, delegate)

### Key Design Areas

**Status Lifecycle:**
- iPurchase uses: NOT SUBMITTED → PENDING → APPROVED / REJECTED
- Same model or different? TBD

**Field Locking Rules (from mst.js analysis):**
- Default: all fields disabled on any approval form
- NOT SUBMITTED or REJECTED + you're the owner → all fields enabled, save/delete/submit available
- PENDING + you're the owner → retract button visible
- PENDING + you can approve → approve/reject buttons visible (requires server check)
- APPROVED → only fields flagged as editAnytime are enabled

**Button Visibility:**

| Button | Shows when |
|---|---|
| Submit | NOT SUBMITTED or REJECTED, you're the owner, record is saved |
| Retract | PENDING, you're the owner |
| Approve | PENDING, you're an authorized approver |
| Reject | PENDING, you're an authorized approver |
| Change Order | APPROVED, record exists |

**Approval Routing:**
- How are approvers determined?
- iPurchase has simple rules (xxapp_mstr) and complex rules (xxAppRule/xxAppField with tree conditions)
- Carry forward, redesign, or both? TBD

**Approval Actions:**
- Approve, Reject, Retract, Send Back, Delegate
- Each action's behavior and side effects TBD

**Audit Trail:**
- Approval History tab content and structure
- What gets logged: who, when, action, comments, routing info

**Change Orders:**
- Requires is_change_order flag + copied_from
- Does a CO go through full re-routing or abbreviated path?
- Tolerance logic? Material change detection? TBD
- Will be informed by iPurchase's existing change order behavior

## Reference

iPurchase's current approval implementation:
- `mst.js` — 52 occurrences of `sApproval > ""` checks, handles all UI locking/button visibility
- `xxapp_mstr` — simple AND-based approval rules
- `xxAppRule` / `xxAppField` — complex nested AND/OR conditional rules
- `xxreq_audit` — approval audit trail
- `ia-canapprove.p` — server-side check for approval authorization
- See iPurchase docs: `approval-systems.md`, `change-orders.md`
