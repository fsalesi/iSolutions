# 6. Notes & Attachments

> Notes are a platform-wide social layer already built into the base Page. Attachments have two mechanisms: named attachment fields on the form, and generic attachment tabs with configurable types.

## Notes (Platform-Wide)

The notes system is already built and lives at the base Page level. Every page — hand-coded or generated — gets it automatically. No opt-in, no configuration.

### Already Implemented
- Notes with author tracking, timestamps
- File attachments per note
- @mentions with notifications
- Badge count on the Notes button
- Edit/delete restricted to note author
- Cascading deletes
- Keyed by `table_name` + `record_oid` — works on any record

### Not Business Data

Platform notes are collaborative comments — "Hey Frank, can you review this?" They are NOT business fields like justification, PO notes, or internal memos. Those are fields or attachment types on the form (see below).

## Attachments — Two Mechanisms

### 1. Attachment Fields (Named, Specific Purpose)

A field with type `attachment` in the Entity Designer. Represents a specific named document on the form.

**Examples:**
- W-9 form on Supplier Onboarding
- Vendor Quote on Requisitions
- Insurance Certificate on Supplier Onboarding

**Entity Designer:**
```
Field: w9
Type: attachment
```

**Screen Layout Designer (renderer props):**
```
Renderer: Attachment (auto-selected for attachment type)
Props:
  label: "W-9 Form"
  max_count: 1
  mandatory: before_submit
  view_access: finance
  upload_access: finance
  accept: .pdf,.jpg,.png
```

**UI renders as:** label + status indicator + upload button + filename (inline on the form, in a section like any other field)

**Behavior:**
- Upload stores file in `platform_attachments` with entity_type = table, entity_oid = record, attachment_type = field name
- Field value tracks whether a file is present (platform-managed, not a separate boolean)
- Mandatory before_submit means ApprovalCrudRoute checks this at submit time
- Delete the file → field shows as empty again

### 2. Attachment Tabs (Generic Collections)

A tab added to the form with configurable attachment types. For open-ended document collections.

**Examples:**
- Internal Attachments on Requisitions (unlimited, restricted to buyers)
- External Attachments on Requisitions (unlimited, visible to all)
- Supporting Documents on Journal Entries

**Configuration (in Entity Designer or Screen Layout Designer):**

The admin adds an Attachments tab to the form and defines the available types:

```
Form: Requisitions
  Attachment Tab: ☑ Enabled
  
  Types:
    ┌──────────┬────────────────────┬──────────────┬───────────────┐
    │ Code     │ Label              │ Mandatory    │ Access        │
    ├──────────┼────────────────────┼──────────────┼───────────────┤
    │ internal │ Internal Documents │ never        │ buyers        │
    │ external │ External Documents │ never        │ *             │
    └──────────┴────────────────────┴──────────────┴───────────────┘
```

**UI:** A tab on the form showing a grid of attachments. Upload button with a type picker (dropdown: "Internal" / "External"). User selects type, uploads file. Grid shows all attachments with type, filename, uploader, date. Users only see types they have view access to.

**Per-table attachment tabs:** Attachment tabs can also be added to child tables. They appear within the child's slide-in panel:

```
Form: Requisitions
  Header attachment tab: internal, external
  Line item attachment tab: internal, external
```

### Security

Both mechanisms support per-type security:
- **view_access** — who can see the attachment / attachment type
- **upload_access** — who can upload / replace
- **delete_access** — who can delete

Using user/group lists (same pattern as the rest of the platform).

## Storage

Both mechanisms store in the same table:

```
platform_attachments:
  oid
  domain
  entity_type           ← table name ("suppliers", "requisition_lines")
  entity_oid            ← record oid
  attachment_type       ← field name ("w9") or tab type code ("internal")
  file_name             ← original filename
  file_type             ← MIME type
  file_size             ← bytes
  file_data             ← binary (or path to file storage)
  description           ← optional
  created_at, created_by, updated_at, updated_by
```

## Attachment Tab Scope — Rollup Behavior

Every table with attachments enabled gets its own Attachments tab. The query scope depends on where you are in the form:

- **Header attachment tab** → rolls up ALL attachments from every table in the form tree (header + all children + grandchildren)
- **Child attachment tab** → shows ONLY that child table's attachments

Same component, same grid. The only difference is the query scope.

The header grid includes a **Source** column so you can see where each attachment lives (e.g., "Line Item #3", "Address - 123 Main St").

**Example: Requisitions with 3 tables**
```
Header tab:      shows attachments from header + lines + shipping
Line item tab:   shows only that line's attachments
Shipping tab:    shows only that shipping record's attachments
```

**Header rollup query:**
```sql
SELECT a.*
FROM platform_attachments a
WHERE a.domain = 'demo1'
  AND (
    (a.entity_type = 'requisitions' AND a.entity_oid = 'header-oid')
    OR (a.entity_type = 'requisition_lines' AND a.entity_oid IN (...line oids...))
    OR (a.entity_type = 'requisition_shipping' AND a.entity_oid IN (...shipping oids...))
  )
ORDER BY a.created_at DESC
```

**Child query:**
```sql
SELECT a.*
FROM platform_attachments a
WHERE a.domain = 'demo1'
  AND a.entity_type = 'requisition_lines'
  AND a.entity_oid = 'this-line-oid'
ORDER BY a.created_at DESC
```

No separate "All Documents" opt-in needed. If a form has attachments enabled, the header always sees everything.

## Attachment Type Configuration Table

```
platform_attachment_types:
  oid
  domain                ← * for all domains, or specific
  form_key              ← which form
  table_name            ← which table within the form (header or child)
  source                ← "field" or "tab"
  type_code             ← "w9", "internal", "external"
  type_label            ← display name
  max_count             ← null = unlimited, 1 = single file
  mandatory             ← never / always / before_submit
  accept                ← allowed MIME types / extensions
  view_access           ← users/groups
  upload_access         ← users/groups
  delete_access         ← users/groups
  print_on_output       ← boolean (appears on PO/output documents)
  sort_order
  created_at, created_by, updated_at, updated_by
```
