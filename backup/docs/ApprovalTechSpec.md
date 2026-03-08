# Approval Workflow — Technical Specification

> **Phase 2** — Builds on top of the CrudPanel refactor (Phase 1 complete through Step 4).
> Database schema: migration `013_approval_workflow.py` already executed.
> Functional spec: `ApprovalFunctionality.md`

---

## Architecture Overview

The approval system is a **layer on top of CrudPanel**, not a replacement. It works by:

1. A `useApproval` hook that fetches approval state for a loaded record
2. An `ApprovalCrudPanel` wrapper that injects status-aware behavior into a standard `CrudPanel`
3. Shared components dropped into any approval form (status strip, history tab)
4. Server-side action routes + a rule engine that runs at submit time

The key design constraint: **no page-level form code should need to know about approval internals**. The page passes `formKey` to `ApprovalCrudPanel`, and the panel handles everything else.

---

## Integration Points (drill into each)

### 1. `useApproval` Hook

The central hook. Fetches approval state when a record loads and exposes everything the panel needs.

- **Input:** `formKey: string`, `recordOid: string | null`
- **Fetches:** `GET /api/approval/can-approve?form_key=X&record_oid=Y`
- **Returns:**
  - `status` — current record status (`''` | `'PENDING'` | `'APPROVED'`)
  - `isOriginator` — current user === `created_by` (or `submitted_by` for change orders)
  - `canApprove` — boolean from server (async, checks group membership, delegates, etc.)
  - `loading` — boolean while fetching
  - `refresh()` — re-fetches (call after any approval action)
- **Derived computed props** (from status + isOriginator + canApprove):
  - `saveDisabled` — true when PENDING or APPROVED
  - `deleteDisabled` — true when PENDING or APPROVED
  - `newHidden` / `copyHidden` — true when PENDING or APPROVED (approval forms don't "new" mid-workflow)
  - `formReadOnly` — true when PENDING or APPROVED, or when not originator on NOT SUBMITTED
  - `approvalActions: CrudAction[]` — context-sensitive buttons (see §3 below)

---

### 2. `ApprovalCrudPanel` Component

A thin wrapper around `CrudPanel`. The page file uses this instead of `CrudPanel` when `forms.has_approvals = true`.

- **Props:** All `CrudPanel` props, plus:
  - `formKey: string`
- **Internally:**
  - Runs `useApproval(formKey, row?.oid)` — re-runs when `row.oid` changes
  - Passes `saveDisabled`, `deleteDisabled`, `newHidden`, `copyHidden` into CrudPanel
  - Merges `approvalActions` into `extraActions`
  - Wraps `renderBody` to prefix `<ApprovalStatusStrip>` above the caller's content
  - Passes `readOnly={formReadOnly}` into renderBody props (CrudPanel needs a new `readOnly` prop added to its renderBody signature)
- **Implication for CrudPanel:** Need to add `saveDisabled`, `deleteDisabled`, `newHidden`, `copyHidden` props, and add `readOnly` to the renderBody props interface

---

### 3. Toolbar / Action Buttons

`useApproval` computes `approvalActions: CrudAction[]` based on state. These merge into CrudPanel's `extraActions`.

| Status | User | Actions shown |
|--------|------|---------------|
| NOT SUBMITTED / '' | Originator | Submit |
| PENDING | Originator | Retract |
| PENDING | canApprove = true | Approve, Reject, Send Back |
| PENDING | Force approver (FORCE_APPROVAL_ROLE_LIST) | Force Approve |
| APPROVED | — | — (Change Order in Phase 3) |

- Each action button calls its action route (§7), then calls `refresh()` on the link publisher and `useApproval.refresh()`
- Approve, Reject, Send Back open an inline notes dialog before posting (notes are required for Reject and Send Back)
- Separator before the approval actions group

---

### 4. Status Strip (`ApprovalStatusStrip`)

A read-only bar injected by `ApprovalCrudPanel` at the very top of the form body — before any tabs or sections.

- **Shows:** Status badge | Submitted By | Entry Date
- **Status badge colors:**
  - `''` (not submitted) → neutral/muted
  - `PENDING` → warning (amber)
  - `APPROVED` → success (green)
  - `REJECTED` → danger (red) — same as not submitted functionally
- **Hidden** when `isNew` (no status on a new record yet)
- Thin single-line bar, not a full section — doesn't steal vertical space

---

### 5. Field Locking

`formReadOnly: boolean` flows from `useApproval` through `ApprovalCrudPanel` into the page's `renderBody` as a new prop in the renderBody props interface.

- **Locking logic:** `formReadOnly = status === 'PENDING' || status === 'APPROVED' || (!isOriginator && status === '')`
- The page's form fields receive `readOnly` and pass it to `useFieldHelper` / individual components
- `editAnytime` fields (future) — a per-field flag in form layout metadata that overrides locking
- Child grids: when `formReadOnly`, `CrudPanel` in the child slot gets its own `saveDisabled=true`, `deleteDisabled=true`, `newHidden=true` — child panels check parent's `CrudPanelContext` for an `approvalReadOnly` signal
- **Implementation:** `CrudPanelContext` gets an optional `readOnly: boolean` value; child panels read it and short-circuit their own CRUD if set

---

### 6. Approval History Tab (`ApprovalHistoryTab`)

A tab component the page file includes in its tab list (not auto-injected — explicit by the page author).

- **Fetches:** `GET /api/approval_history?form_key=X&record_oid=Y`
- **Shows:** Timeline grouped by submission attempt, then by level within each attempt
- **Each row:** Level | Approver | Approved By | Status badge | Activated At | Action At | Notes
- Group headers: "Attempt 1 — Submitted Jan 15 by frank"
- Status badges: PENDING (amber), APPROVED (green), REJECTED (red), REMOVED (muted), REROUTED (muted)
- Hidden when `isNew`
- Read-only, no edit actions

---

### 7. Action API Routes

All under `/api/approval/`. All are POST (or GET for can-approve). All return `{ ok: true }` or error.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/approval/can-approve` | GET | Returns `{ canApprove, isOriginator }` for current user + record |
| `/api/approval/submit` | POST | Runs rule engine, generates approval chain, sets status PENDING |
| `/api/approval/retract` | POST | REMOVES open approval steps, sets status back to `''` |
| `/api/approval/approve` | POST | Records approval, advances to next level or sets APPROVED |
| `/api/approval/reject` | POST | Records rejection, sets record status to `''` (REJECTED functionally) |
| `/api/approval/send-back` | POST | Records current step as REROUTED, reactivates prior level |
| `/api/approval/force-approve` | POST | Closes all PENDING steps as FORCE_APPROVED, sets status APPROVED |

All action routes:
1. Validate user authorization for that action
2. Perform the action in a transaction
3. Return the updated record status so the client can refresh

---

### 8. Rule Engine (`src/lib/approval-engine.ts`)

Server-side. Called exclusively by `/api/approval/submit`.

**Function:** `evaluateRules(formKey, domain, headerRow, lineRows) → { steps: ApprovalStep[], errors: string[] }`

**What it does:**
1. Queries `approval_rules` WHERE `form_key` matches and `is_active = true` and not `is_validation`
2. For each rule, evaluates its `approval_conditions` tree against the submitted row
3. For matching rules (sorted by `level`), resolves the `approver` field:
   - Plain user ID → verify user exists and is active
   - Group ID → resolve via `group_members` dynamically at query time
   - `$SUPERVISORS` → walk `users.supervisor_id` chain until approval_limit >= amount
   - `$COST-CENTER:ROLE` → resolve via `approval_roles` table
4. Runs validation rules (negative sequence levels, `is_validation = true`) first — errors block submission
5. Applies settings: `APPROVALS_REMOVE_ORIGINATOR`, `APPROVALS_MULTIPLE`, `APPROVALS_REMOVE_ORIGINATOR_FROM_GROUP`
6. Checks for unresolvable approvers (inactive user, no delegate, missing role) → adds to errors
7. Returns array of `ApprovalStep` objects to insert into `approval_history`, or error list

**Condition tree evaluation:** Recursive descent. Start at nodes where `parent_group = 0`, evaluate operator (AND/OR) against children. Field conditions support: `eq`, `ne`, `gt`, `ge`, `lt`, `le`, `in_list`, `not_in_list`, `is_blank`, `is_not_blank`, `can_do`, `not_can_do`.

---

### 9. Admin Screens (CRUD for approval config)

Standard CrudPage / CrudPanel screens. No approval-specific behavior needed in the UI.

- **Approval Rules** (`/api/approval_rules`) — list + edit rule headers
- **Approval Conditions** (`/api/approval_conditions`) — condition tree editor (complex UI, Phase 2b)
- **Approval Roles** (`/api/approval_roles`) — role-to-user mappings

The condition tree editor is the most complex UI item — a visual AND/OR tree builder. This can be a later sub-phase; initially conditions can be inserted manually or via a basic table editor.

---

### 10. Approval Dashboard

A standalone page (`/approvals`) — a filtered DataGrid over `approval_history`.

- **Filters:** `status = PENDING` AND current user is in the `approver` field (or group member)
- **Columns:** Form, Record, Level, Requested By, Submitted At, Days Waiting
- **Click row** → deep link into the originating record, record pre-selected
- Uses standard DataGrid + fetchPage, no CrudPanel (read-only browse)
- Sidebar badge showing pending count (fetched on login)

---

## Changes Required to Existing Components

| Component | Change |
|-----------|--------|
| `CrudPanel` | Add `saveDisabled`, `deleteDisabled`, `newHidden`, `copyHidden` props; add `readOnly` to renderBody props |
| `CrudPanelContext` | Add optional `readOnly: boolean` for child panels to consume |
| `CrudToolbar` | Honor `newHidden`, `copyHidden` to conditionally omit those buttons |

---

## Task List

### Phase A — CrudPanel Extensions (prerequisite)
- [ ] Add `saveDisabled`, `deleteDisabled`, `newHidden`, `copyHidden` props to CrudPanel
- [ ] Add `readOnly` to renderBody props interface in CrudPanel
- [ ] Add `readOnly` signal to CrudPanelContext
- [ ] Honor `newHidden` / `copyHidden` in CrudToolbar

### Phase B — Core Hooks & Components
- [ ] `useApproval(formKey, recordOid)` hook
- [ ] `GET /api/approval/can-approve` route
- [ ] `ApprovalStatusStrip` component
- [ ] `ApprovalCrudPanel` wrapper component
- [ ] `ApprovalHistoryTab` component + `GET /api/approval_history` route

### Phase C — Action Routes
- [ ] `POST /api/approval/submit`
- [ ] `POST /api/approval/retract`
- [ ] `POST /api/approval/approve`
- [ ] `POST /api/approval/reject`
- [ ] `POST /api/approval/send-back`
- [ ] `POST /api/approval/force-approve`

### Phase D — Rule Engine
- [ ] `src/lib/approval-engine.ts` — condition tree evaluator
- [ ] Approver resolver: plain user, group, $SUPERVISORS, $ROLE
- [ ] Validation rule pre-flight (negative sequence levels)
- [ ] Setting integrations: APPROVALS_REMOVE_ORIGINATOR, APPROVALS_MULTIPLE, APPROVALS_REMOVE_ORIGINATOR_FROM_GROUP
- [ ] Error accumulator (unresolvable approvers, zero matches)

### Phase E — Admin Screens
- [ ] `/api/approval_rules` CRUD route
- [ ] `/api/approval_roles` CRUD route
- [ ] Approval Rules page component
- [ ] Approval Roles page component
- [ ] Condition tree editor (Phase 2b — later)

### Phase F — Dashboard
- [ ] `/api/approval/pending` — pending approvals for current user
- [ ] Approval Dashboard page (DataGrid + deep link)
- [ ] Sidebar pending count badge

### Phase G — First Form Integration (proof of concept)
- [ ] Pick one form (TBD), enable `has_approvals`
- [ ] Wire `ApprovalCrudPanel` into its page file
- [ ] Add `ApprovalHistoryTab` to its tab list
- [ ] End-to-end test: submit → approve → approved state

---

## Open Questions

All resolved. See Decisions Log below.


---

## Decisions Log

| # | Question | Decision | Notes |
|---|----------|----------|-------|
| 1 | Notes dialog UX (Reject / Send Back) | **Center modal** | Standard centered modal with textarea + Confirm/Cancel |
| 2 | Condition tree editor UI | **Reuse AdvancedSearch tree components** | `FilterGroupNode`, `FilterConditionRow`, `filter-tree-ops.ts`, `filter-types.ts` already implement a full AND/OR recursive tree builder. Adapt with approval-specific field/operand lists instead of DataGrid column lists. The data model maps cleanly: our `group_num`/`parent_group` ↔ their `FilterGroup.id`/parent relationship. |
| 3 | `$SUPERVISORS` stopping condition | **Stop when `approval_limit >= amount`** | Only valid when `amount_field` on the rule points to a numeric header field. If no `amount_field` configured, walk only one level (immediate supervisor). If chain exhausted with no one covering the amount, that is a submission error. |
| 4 | `APPROVALS_MULTIPLE` / deduplication | **KEEP_LAST default, with single-member group dedup** | iPurchase current version already handles this correctly. iSolutions must replicate the same two-pass dedup logic (see Decision 4 detail below). |
| 5 | Email notifications | **Stub only** — `sendApprovalNotification(step)` as a no-op comment | No email system built yet. Each action route calls the stub so wiring is in place for Phase 3. |

### Decision 4 — Deduplication Algorithm Detail

iPurchase current version (confirmed Dec 2025) already handles single-member group deduplication correctly. iSolutions rule engine replicates the same logic:

**Per candidate approver entry, in order:**

1. **Direct match check:** look for existing `approval_history` row for this attempt where `required_approver = currentApprover` (the raw group ID or user ID). If found → go to KEEP_FIRST/KEEP_LAST/KEEP_ALL logic.

2. **Single-member group check** (only if step 1 found nothing, `decom_list` resolves to exactly 1 user, and setting `APPROVALS_MULTIPLE_SINGLE_MEMBER` ≠ FALSE):
   - Scan all existing rows for this attempt
   - Match if: existing `required_approver = singleUser` (direct user match)  
     OR existing `decom_list` is also a single user equal to `singleUser` (group-vs-group)
   - This catches: `frank` (direct) vs `CFO_GROUP` (sole member = frank), and `CFO_GROUP` vs `CEO_GROUP` (both resolve to same person)

3. **If still not found → create new row.** If found → apply KEEP_FIRST/KEEP_LAST/KEEP_ALL:
   - `KEEP_ALL` → always create, set `routing_sequence = level`
   - `KEEP_FIRST` → if new level < existing, update rule name + group identity on existing row; set `routing_sequence = min`
   - `KEEP_LAST` (default) → if new level > existing, update rule name + group identity on existing row; set `routing_sequence = max`

4. **Group identity update (KEEP_FIRST/KEEP_LAST only):** when the winning rule changes, also update `required_approver` and `decom_list` on the existing row to reflect the winning rule's approver — preserving group semantics so any group member can still action it.

**Setting:** `APPROVALS_MULTIPLE_SINGLE_MEMBER` (default TRUE) — set FALSE to disable single-member group dedup and allow duplicates.

### Decision 2 — Condition Tree Editor Mapping

The existing filter tree data model maps to `approval_conditions` as:

| AdvancedSearch concept | approval_conditions column |
|------------------------|---------------------------|
| `FilterGroup.logic` (and/or) | `operand` on the operator node row |
| `FilterGroup.id` | `group_num` (>0) |
| Parent group reference | `parent_group` |
| `FilterCondition.field` | `left_side` |
| `FilterCondition.operator` | `operand` on the field condition row |
| `FilterCondition.value` | `right_side` |

The tree editor component will use the same `GroupNode` / `FilterConditionRow` components but swap the column/operator lists for approval-specific ones (form fields + approval operands like `can_do`, `not_can_do`).

