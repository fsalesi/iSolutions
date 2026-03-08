# 5. Copy, Template & Change Order Support

> Three mechanisms for creating records from existing records: simple copy, templates, and change orders. Copy is universal. Change orders require approvals.

## Copy

Available on all forms. Creates a new record based on an existing one.

### How It Works

1. User views an existing record, clicks Copy
2. Platform reads the source record (header + all children)
3. Clears non-copyable fields (see below)
4. Generates new oid for every record (header + children)
5. Sets `copied_from` = source record's oid
6. Sets `is_change_order` = false
7. Resets all audit fields (created_at/by = now/current user)
8. Opens the new record in edit mode — user can modify before saving

### Non-Copyable Fields

Certain fields are never copied. These are determined by:

**Auto-excluded (platform-managed, always cleared):**
- `oid` — new UUID generated
- `domain` — keeps current user's domain (not the source domain)
- `created_at`, `created_by`, `updated_at`, `updated_by` — reset
- `custom_fields` — TBD: copy or clear?
- `copied_from` — set to source oid
- `is_change_order` — set to false
- All approval fields: status (reset to blank), submitted_by/at, approved_by/at — cleared

**Configurable per field:**
- Each field in the Entity Designer has a `copyable` flag (default: true)
- Admin can flag specific fields as non-copyable (e.g., unique reference numbers, one-time dates)
- Non-copyable fields are cleared to null or their default value on copy

### Child Records

All child (and grandchild) records are copied along with the header:
- Each child record gets a new oid
- FK fields (oid_parent) are updated to point to the new parent's oid
- Same copyable/non-copyable logic applies to child fields
- The entire tree is cloned

## Templates

Templates are just regular records with a special treatment.

### How They Work

- Any record can be flagged as a template (TBD: how — a status? a flag field?)
- Templates appear in a "Create from Template" picker
- Selecting a template performs the same operation as Copy
- Templates are typically records with pre-filled common values but no unique/transactional data

### TBD

- How to flag a record as a template
- Whether templates live in the same table or a separate store
- Template management UI (who can create/edit/delete templates)
- Per-domain templates

## Change Orders

Only available on forms with approvals enabled. Creates a new record that represents a modification to an already-approved record.

### How It Works

1. User views an approved record
2. Clicks Change Order (button only visible when status = APPROVED)
3. Platform performs a Copy (same as above), but additionally:
   - Sets `is_change_order` = true
   - `copied_from` = source record's oid
4. User modifies the new record
5. On Submit, the change order enters the approval workflow
6. On Approve, the change order replaces/supersedes the original

### Change Order vs Copy

| | Copy | Change Order |
|---|---|---|
| Available on | All forms | Approval forms only |
| Source record status | Any | APPROVED only |
| `copied_from` | Set | Set |
| `is_change_order` | false | true |
| Enters approval workflow | Only if form has approvals | Always |
| Relationship to source | Independent new record | Supersedes the original |

### What "Supersedes" Means

TBD — when a change order is approved:
- Does the original record's status change? (e.g., to SUPERSEDED)
- Does the platform maintain a revision chain? (original → CO1 → CO2)
- Can you view the full history of changes?
- What about the original's child records?

These details will be informed by iPurchase's existing change order behavior (xxreq_update_po, xxreq_copied_from, xxreq_mat_change, tolerance logic).

## Platform Actions

The platform auto-provides these actions based on form configuration:

| Action | Shows when | Form type |
|---|---|---|
| Copy | Always (record exists) | All forms |
| Change Order | Record is APPROVED | Approval forms only |
| Create from Template | New record mode | All forms (if templates exist) |

These are standard platform buttons — not configured in the Screen Layout Designer.
