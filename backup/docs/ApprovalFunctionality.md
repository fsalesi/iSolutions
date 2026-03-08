# Approval Workflow — Functional Specification

> **PHASE 2** — Build after Form Platform Core (Phase 1) is complete and stable.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Fields](#2-database-fields)
3. [Status Lifecycle](#3-status-lifecycle)
4. [Form Behavior & Field Locking](#4-form-behavior--field-locking)
5. [Action Buttons](#5-action-buttons)
6. [Approval History Tab](#6-approval-history-tab)
7. [Approval Dashboard](#7-approval-dashboard)
8. [Email Actions & Deep Links](#8-email-actions--deep-links)
9. [Approval Rule Engine](#9-approval-rule-engine)
10. [Approval Rules Screen](#10-approval-rules-screen)
11. [System Settings](#11-system-settings)

---

## 1. Overview

The approval workflow is an optional feature enabled per form via the **"Use Approval Workflow"** toggle in the Entity Designer (`forms.has_approvals = true`).

When enabled, the system automatically:
- Adds approval fields to the header table
- Adds a platform-level approval history table linked to the record
- Injects approval UI into the form (status strip, action buttons, Approval History tab)
- Evaluates configured approval rules on submission to generate a routing chain
- Notifies approvers via email with direct action links

**Key constraint:** Approvals only apply to the **header/main table** of a form. All child tables participate in locking behavior but have no independent approval state.

---

## 2. Database Fields

### 2.1 Approval Fields (auto-added to header table when `has_approvals = true`)

| Field | Type | Notes |
|-------|------|-------|
| `status` | `citext NOT NULL DEFAULT ''` | NOT SUBMITTED, PENDING, APPROVED, REJECTED |
| `submitted_by` | `citext NOT NULL DEFAULT ''` | Who submitted — can differ from `created_by` on change orders |
| `submitted_at` | `timestamptz` | When submitted |
| `approved_at` | `timestamptz` | When final approval was recorded |
| `approved_by` | `citext NOT NULL DEFAULT ''` | Who gave final approval |
| `is_change_order` | `boolean NOT NULL DEFAULT false` | Change order flag (future use) |

> Note: `created_by` and `created_at` are standard fields on every table and serve as the originator/entry date. `submitted_by` is separate because on change orders the submitter may differ from the original creator.

### 2.2 Platform Approval History Table (`platform_approval_history`)

Shared table across all approval-enabled forms. One row per approval step per submission attempt.

| Field | Type | Notes |
|-------|------|-------|
| `oid` | `uuid` | Primary key |
| `form_key` | `citext` | Which form |
| `record_oid` | `uuid` | FK to the header record |
| `attempt` | `integer` | Submission attempt number (increments on each resubmit) |
| `activated_at` | `timestamptz` | When this approval step became active |
| `level` | `numeric` | Approval sequence level (decimal) |
| `approver` | `citext` | Required approver — user ID or group ID |
| `decom_approver` | `citext` | Expanded group members (space-separated user IDs) |
| `approved_by` | `citext` | Who actually acted (group member or delegate) |
| `status` | `citext` | APPROVED, REJECTED, PENDING, REMOVED, REROUTED |
| `notes` | `text` | Required for Reject and Send Back actions |
| `last_notified_at` | `timestamptz` | When last email notification was sent (populated when email phase is built) |
| `oid_rule` | `uuid` | FK to the approval rule that generated this step |
| `created_at` | `timestamptz` | Standard audit field |
| `created_by` | `citext` | Standard audit field |

---

## 3. Status Lifecycle

```
NOT SUBMITTED  ──[Submit]──►  PENDING  ──[Approve]──►  APPROVED
      ▲                          │
      │                    [Reject / Send Back]
      └──────────────────────────┘
```

- **NOT SUBMITTED** — default state on record creation. Originator can edit freely.
- **PENDING** — submitted, awaiting approval. Fields locked (see Section 4).
- **APPROVED** — fully approved. All fields locked.
- **REJECTED** — functionally identical to NOT SUBMITTED from the originator's perspective. They can make changes and resubmit. Each resubmit increments the attempt counter.

---

## 4. Form Behavior & Field Locking

### 4.1 Status Strip

A read-only strip displayed at the top of the form (above Tab 1) showing:
- **Status** — current status value, visually highlighted
- **Submitted By** — the user who submitted the record
- **Entry Date** — `created_at` from the record

### 4.2 Field Locking Rules

| State | Who | Fields | Available Actions |
|-------|-----|--------|-------------------|
| NOT SUBMITTED or REJECTED | Originator | All editable | Save, Delete, Submit |
| NOT SUBMITTED or REJECTED | Anyone else | All locked | — |
| PENDING | Originator | All locked | Retract |
| PENDING | Authorized approver | All locked | Approve, Reject, Send Back |
| PENDING | Anyone else | All locked | — |
| APPROVED | Anyone | All locked | — |

> **Future enhancement:** Certain approvers (e.g. Finance, Purchasing) may be allowed to edit fields while PENDING without triggering a full re-route. This will be a configurable permission, not in initial build.

### 4.3 Child Table Locking

All child grids are **fully read-only** when the record is in PENDING or APPROVED state — no Add, Edit, or Delete available.

---

## 5. Action Buttons

### 5.1 Originator Actions

**Submit**
- Visible when: status is NOT SUBMITTED or REJECTED, current user is originator, record is saved
- Behavior:
  1. Runs validation rules — if any match, blocks submission and displays the message
  2. Evaluates approval rules to generate routing chain (platform_approval_history rows)
  3. Sets `status = PENDING`, `submitted_by = current user`, `submitted_at = now()`
  4. Increments attempt counter
  5. Sends email notifications to first-level approvers (when email phase is built)

**Retract**
- Visible when: status is PENDING, current user is originator
- Behavior:
  1. Sets `status = NOT SUBMITTED`
  2. Marks all current approval history rows for this attempt as REMOVED
  3. No email sent

### 5.2 Approver Actions

All approver actions are only visible when:
- Status is PENDING
- Current user is an active approver on this record (server-side check against `platform_approval_history`)
- A delegate acting on behalf of an approver has the same access

**Approve**
- Behavior:
  1. Marks this approver's step as APPROVED in `platform_approval_history`, sets `approved_by = current user`
  2. If more steps remain: activates next level's approver step(s), sends email notifications
  3. If this is the final step: sets header `status = APPROVED`, `approved_at = now()`, `approved_by = current user`
  4. Evaluates Notify Only rules and queues notification emails (when email phase is built)
  5. Executes the custom procedure configured on the rule (if any)
  6. If `AUTO_APPROVE_FORWARD` is enabled, auto-approves any other pending steps for this user (except the final step)
  7. If `INQUIRY_AFTER_APPROVAL` includes this user, redirect to their pending queue

**Reject**
- Requires notes (mandatory)
- Behavior:
  1. Opens a modal with a required Notes field
  2. Marks this approver's step as REJECTED
  3. Sets header `status = REJECTED`
  4. Marks all remaining pending steps as REMOVED
  5. Notifies originator (when email phase is built)

**Send Back**
- Requires notes (mandatory)
- Behavior:
  1. Opens a modal showing a list of prior approvers who have already approved (from `platform_approval_history` for the current attempt)
  2. User selects which approver to send back to and enters notes
  3. The selected approver's step is reactivated (status back to PENDING)
  4. All steps between the selected approver and the current approver are marked REMOVED
  5. Record remains in PENDING state
  6. Notifies the selected approver (when email phase is built)

### 5.3 Force Approve

- Available to users/groups configured in `FORCE_APPROVAL_ROLE_LIST`
- Bypasses all open approvals regardless of routing
- Sets `status = APPROVED` immediately
- Records action in `platform_approval_history` with a FORCE_APPROVED status for full audit trail
- Primary use case: testing and admin intervention

---

## 6. Approval History Tab

Auto-injected as the second tab on all approval-enabled forms.

### 6.1 Attempt Picker

A dropdown at the top of the tab allowing the user to select which submission attempt to view. Options:
- Attempt 1, Attempt 2, etc. (for records that have been submitted)
- **Approval Simulation** — available when status is NOT SUBMITTED or REJECTED. Shows the routing that *would* be generated if submitted now, without actually submitting. Controlled by `ALLOW_APPROVAL_SIMULATION` setting.

### 6.2 Approval History Grid

Displays one row per approval step for the selected attempt:

| Column | Notes |
|--------|-------|
| Activated On | When this step became active |
| Level | Decimal sequence level |
| Approver | Rule-assigned approver. If a group: shows group name with members listed beneath |
| Approved By | Who actually acted (group member or delegate) |
| Status | Visual indicator — Approved (green), Rejected (red), Pending (yellow), Removed (grey) |
| Notes | Required for Reject and Send Back |
| Last Notified | Populated when email phase is built |

---

## 7. Approval Dashboard

A dedicated screen visible after login showing all records pending the current user's approval, across all forms.

- Displays as a datagrid (or multiple grids, TBD) showing all pending items
- Columns include: Form Name, Record identifier, Submitted By, Submitted At, Level, Amount (if applicable)
- Clicking a row deep-links directly to that record in the correct form
- Users/groups in `LOGIN_APPROVERS_ALWAYS_SEE_APPROVALS` are always redirected to this dashboard on login, even if they have nothing pending

---

## 8. Email Actions & Deep Links

### 8.1 Deep Link Format

All links to approval records use a standardized deep link format:

```
/form/[formKey]?oid=[record_oid]&approvalAction=[action]
```

Examples:
- `/form/POReq?oid=xxx` — view the record
- `/form/POReq?oid=xxx&approvalAction=approve` — approve directly
- `/form/POReq?oid=xxx&approvalAction=reject` — go to reject flow

Used by both the approval dashboard (view/action) and email notifications.

### 8.2 Email Approve Link

When an approver clicks the Approve link in an email:
1. User must be logged in — if not, redirect to login then back to the action URL
2. A minimal page (no full form UI) processes the approval action
3. Displays one of:
   - **"Your approval has been recorded"** — with a deep link to view the full record
   - **"Your approval is not required at this time"** — if they are no longer an active approver (step already actioned by a group member, record retracted, etc.)

### 8.3 Email Reject Link

When an approver clicks the Reject link in an email:
1. Same login requirement as above
2. A minimal page displays a notes field and a Reject button (notes are mandatory)
3. On submission, processes the rejection
4. Displays confirmation with deep link to the record

### 8.4 Email View Link

Standard deep link directly to the form. Requires login.

> Note: Email sending is a later phase. The deep link infrastructure and the minimal action pages are in scope for the initial build so that the email phase can plug in cleanly.

---

## 9. Approval Rule Engine

### 9.1 Overview

When a record is submitted, the engine:
1. Evaluates all **Validation Rules** first — blocks submission if any match
2. Evaluates all **Approval Rules** in sequence order — generates `platform_approval_history` rows
3. After final approval, evaluates all **Notify Only Rules** — queues notification emails (email phase)

The engine is form-agnostic — it works against whatever form key and tables are passed in, following the same pattern as `ia-getapprovers.i` in iApprove.

### 9.2 Rule Types

All three rule types share the same rule structure but behave differently:

| Type | Triggered | Behavior |
|------|-----------|----------|
| **Approval Rule** | On submit | Generates approval steps if conditions match |
| **Notify Only** | After final approval | Sends FYI emails to matched approvers, no approval step created |
| **Validation Rule** | On submit (before routing) | Blocks submission and shows message text if conditions match |

### 9.3 Rule Evaluation Order

1. Validation rules run first (negative sequence numbers by convention)
2. Approval rules run in ascending sequence order
3. If a rule has **Stop Process Rules = true** and its conditions match, evaluation stops — no further rules are processed
4. Notify Only rules are completely separate — evaluated only after final approval

### 9.4 Duplicate Approver Handling (`MULTIPLE_APPROVALS`)

If the same approver appears at multiple levels:
- **KEEP_ALL** — all instances kept, approver must approve at each level
- **KEEP_FIRST** — only the earliest instance kept
- **KEEP_LAST** *(default)* — only the latest (highest authority) instance kept

### 9.5 Auto-Approve Forward (`AUTO_APPROVE_FORWARD`)

When an approver approves their step, the system automatically approves all other pending steps for that same user — except the final step, which always requires an explicit action.

Also applies via group membership: if a user approves as a group member, their auto-forward still applies to later individual appearances.

### 9.6 Originator Self-Approval

- **`REMOVE_ORIG`** *(default TRUE)* — the originator cannot be an approver on their own record. If they appear as a named approver, they are removed from the routing.
- **`REMOVE_ORIGINATOR_FROM_GROUP`** *(default TRUE)* — if the originator is a member of an approval group in the routing, they are removed from that group's membership for this record.
- **`USE_APP_AMOUNT_OWN_REQS`** — configurable list of users whose own approval limit can be used to self-approve. If their limit exceeds the record amount, it converts directly to approved without routing.

### 9.7 Delegate Behavior

- Each user can have one configured delegate (`wus_delegate`) who can act on their behalf
- A delegate sees the delegator's pending items in the approval dashboard
- Audit trail records both who was required to approve and who actually acted
- **`OOF_LIMIT_TO_APPROVERS`** — if TRUE, users can only delegate to other users who are themselves approvers
- **`USE_CHAINED_DELEGATES`** — if TRUE, if A delegates to B and B delegates to C, then C can act for A

### 9.8 Supervisor Override (`ALLOW_SUPERVISORS_TO_APPROVE`)

Configurable list of users/groups who can approve on behalf of their direct reports, without formal delegation being set up. Creates full audit trail.

---

## 10. Approval Rules Screen

An admin screen for configuring approval rules, accessible per form.

### 10.1 Rule Header Fields

| Field | Notes |
|-------|-------|
| Form | Which form this rule applies to |
| Domain | Specific domain or All Domains |
| Rule Name | Unique name |
| Approval Level | Decimal sequence number |
| Approver List | User ID, group ID, or dynamic variable (see 10.3) |
| Amount Field | Any numeric field from any table in the form (optional) |
| Accumulation | **Sum All Lines** or **Per Line** (only relevant if Amount Field is set) |
| Min Approval Amount | Compared against accumulated amount |
| Max Approval Amount | Compared against accumulated amount |
| Instructions | Shown to approver on screen and in email notification |
| Custom Procedure | Executed after this rule's step is approved. Options pulled from form's CrudRoute customer shim |
| Active | On/Off |
| Stop Process Rules | Halt rule evaluation after this rule fires |
| Notify Only | Rule is deferred until final approval, sends FYI email only |
| Validation Rule | Rule becomes a submission validator — Approver List field becomes the message text shown to the user |

> Note: When **Eval at Line Level** is needed (one approval step per matching child row, e.g. one PM per project line), this is configured via the rule. The approver variable should reference a field that varies per line (e.g. `$Lines.project_manager`).

### 10.2 Conditions (child grid)

Conditions are field/value comparisons that determine whether a rule applies to a given record. All conditions within an AND group must be true. Conditions within an OR group require at least one to be true. Groups can be nested arbitrarily.

**Condition row fields:**
- **Left Side** — a field reference (`Header.Cost`, `Lines.Project`) or a custom expression (`sum(Lines.Amount)`, `hour(now())`, `day_of_week()`)
- **Operator** — eq, ne, gt, ge, lt, le, In List, Not In List, Is Blank, Is Not Blank, Can-Do, Not Can-Do
- **Right Side** — a static value, a dynamic variable (`$COST CENTER:Director`), another field reference, or a custom expression

The condition builder UI supports:
- Visual AND/OR group builder for standard conditions
- Free-form expression entry on either side of any condition, supporting aggregates (`sum`, `count`, `avg`), date/time functions (`today()`, `hour(now())`, `day_of_week()`), and field arithmetic

### 10.3 Dynamic Approver Variables

| Variable | Resolves To |
|----------|-------------|
| `$fieldname` | Value of a field on the header record (e.g. `$submitted_by`, `$buyer`) |
| `$Table.fieldname` | Value of a field on a specific table |
| `$SUPERVISORS` | All supervisors up the chain until one with sufficient approval limit is found |
| `$SUPERVISOR` | Immediate supervisor only |
| `$LAST_SUPERVISOR` | Highest supervisor with sufficient approval limit (skips intermediates) |
| `$COST-CENTER:ROLE` | Whoever holds the specified role for the record's cost center (roles defined in system settings) |

---

## 11. System Settings

Approval behavior is configurable via system settings. Settings are per-domain or global.

### 11.1 Core — Initial Build

| Setting | Default | Description |
|---------|---------|-------------|
| `MULTIPLE_APPROVALS` | KEEP_LAST | How to handle same approver at multiple levels: KEEP_ALL, KEEP_FIRST, KEEP_LAST |
| `AUTO_APPROVE_FORWARD` | TRUE | After approving, auto-approve all other pending steps for same user (except final) |
| `ALLOW_SUPERVISORS_TO_APPROVE` | `*` | Can-Do list of users/groups who can approve on behalf of subordinates |
| `ALLOW_APPROVAL_SIMULATION` | `*` | Can-Do list of users allowed to view approval simulation |
| `FORCE_APPROVAL_ROLE_LIST` | `admin` | Can-Do list of users allowed to force-approve any record, bypassing routing |
| `REMOVE_ORIG` | TRUE | Remove originator from their own approval routing |
| `REMOVE_ORIGINATOR_FROM_GROUP` | TRUE | Remove originator from approval groups on their own records |
| `USE_APP_AMOUNT_OWN_REQS` | — | Can-Do list of users who can self-approve if their approval limit exceeds the record amount |
| `ROLES` | — | Comma-separated list of role names for `$COST-CENTER:ROLE` variable |
| `ROLE_MISSING_SKIP_LIST` | — | If a role mapping is missing for a type in this list, skip silently. Otherwise block submission |
| `APP_ORIG_OR_OBO` | OBO | Whether approval rule originator conditions match against `created_by` or `submitted_by` |
| `APP_SUPERVISOR_SEQ` | 10 | Approval level assigned to supervisor chain approvers |
| `SUPERVISOR_APPROVAL_FIELD` | `wus_supervisor` | Field used to walk the supervisor chain |
| `OOF_LIMIT_TO_APPROVERS` | FALSE | If TRUE, users can only delegate to other approvers |
| `USE_CHAINED_DELEGATES` | FALSE | If TRUE, delegation chains through multiple levels (A→B→C means C can act for A) |
| `REMOVE_APPROVER_FROM_GROUPS` | FALSE | If TRUE, removes an approver from later groups once they have approved |
| `REMOVE_ORIGINATOR_FROM_GROUP_CO` | FALSE | Remove originator from routing on change orders |
| `NO_MGR_ROUTE_TO` | — | Skip supervisor chain and route directly to this user/group instead |
| `REMINDER_DAYS` | 3 | Days before sending reminder emails to pending approvers |
| `INQUIRY_AFTER_APPROVAL` | `*` | Can-Do list of users redirected to their pending queue after approving |
| `LOGIN_APPROVERS_ALWAYS_SEE_APPROVALS` | `*` | Can-Do list of users always directed to approval dashboard on login |

### 11.2 Later Phases

| Setting | Phase |
|---------|-------|
| `ALLOWED_DOLLAR_INCREASE` / `ALLOWED_PERCENT_INCREASE` | Approver edit capability |
| `ALLOW_APPROVER_CHANGES` / `ALLOW_APPROVER_CHANGES_*` | Manual routing changes |
| `ALLOW_DELETE_APPROVED` | Record management |
| `APPROVAL_EMAIL_REPLY_TO` / `NO_APPROVAL_EMAILS` / `EMAIL_NO_APPROVE_LINK` | Email phase |
| `APPROVAL_METRICS_RED` / `APPROVAL_METRICS_YELLOW` / `SHOW_APPROVER_METRICS` | Metrics |
| `BATCH_APPROVE_GROUPS` / `BATCH_APPROVE_GROUPS_ALWAYS` / `BATCH_APPROVE_GROUPS_FINAL` | Batch approval |
| `DEFAULT_LINES_TO_APPROVED` / `USE_LINE_APPROVALS` | Line-level approvals |
| `ESCALATION_*` / `SUPERVISOR_ESCALATION_*` | Escalation |
| `USE_SUPERVISORS_TO_APPROVE` | Deprecated — use `$SUPERVISORS` variable instead |
| `NEW_REROUTE_METHOD` | Change orders |
| `REMOVE_APPROVER_ROLE_LIST` | Manual routing changes |

---

*Last updated: 2026-03-05*
