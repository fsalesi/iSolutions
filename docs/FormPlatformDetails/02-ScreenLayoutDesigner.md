# 2. Screen Layout Designer

> Live design mode on running forms. Admins place fields, organize sections and tabs, and configure field properties — all per-domain. No separate visual editor; you design the real form.

## Accessing Design Mode

A gear/pencil icon appears in the top-right corner of the form panel. Only visible to users with admin privileges. Click to enter design mode, click again (or Done) to exit.

## Design Mode Behavior

In design mode, the form looks the same but with design controls visible:
- Tab labels become clickable for editing
- Section labels become clickable for editing
- Add Tab, Add Section, Add Field buttons appear
- Existing fields become clickable for property editing
- All editing happens in slide-in panels from the right
- One slide-in at a time — save or cancel returns to design mode, nothing selected

## Actions

### Tab Management
- **Click tab label** → slide-in: rename, reorder, delete
- **Add Tab** → slide-in: name the new tab

### Section Management
- **Click section label** → slide-in: rename, set column count (1-4), reorder within tab, move to different tab, delete
- **Add Section** → slide-in: name, pick target tab, column count

### Field Placement
- **Add Field** → slide-in: pick from unplaced database fields, assign to section, set position
- **Click existing field** → slide-in: field properties (see below)

### Reordering
Fields within a section are an ordered list. Reorder by:
- Changing the position number in field properties
- Drag handles within the section (future enhancement)

To move a field to a different section, change the section assignment in the field properties slide-in.

## Tab Layout

Tabs are a vertical stack of sections. No grid of sections — just one section after another, full width:

```
Tab: "Vendor Info"
  ┌─ Section: "General" (2 columns) ─────────────┐
  │  Vendor Code    [____]   Vendor Name   [____] │
  │  Tax ID         [____]   Status        [____] │
  └────────────────────────────────────────────────┘
  ┌─ Section: "Payment" (2 columns) ──────────────┐
  │  Payment Terms  [____]   Currency      [____] │
  │  Bank Name      [____]   Routing       [____] │
  └────────────────────────────────────────────────┘
```

## Section Layout

Each section has a **column count** property: 1, 2, 3, or 4.

Fields flow in order — left to right, top to bottom — filling the column grid:

```
Section "General" (2 columns), fields in order:
  [Field 1]  [Field 2]         ← positions 1, 2
  [Field 3]  [Field 4]         ← positions 3, 4
  [Field 5 ─────────────]      ← position 5 (col-span: 2, full width)
```

No explicit row/column coordinates. Just an ordered list of fields and the column count determines wrapping.

## Field Properties

When you click a field in design mode, the properties slide-in shows:

### Display
- **Label** — display name (overrides database field name)
- **Placeholder** — ghost text in empty field
- **Help text / tooltip** — guidance for the user
- **Col-span** — how many columns this field occupies (default: 1, up to section column count)
- **Hidden** — don't show on screen (field still exists in DB)

### Behavior
- **Mandatory** — never / always / on submit
- **Read-only** — never / always / after submit
- **Default value** — pre-populated value for new records
- **Searchable** — field appears as a filterable column in the browse grid (default: false)

### Renderer

**Renderer type** — how the field is displayed and edited. Every renderer component declares its own configurable properties with defaults. When the admin picks a renderer, the designer reads the component's declared properties and shows them as real editable fields with defaults filled in. The admin overrides only what they need — only overridden values are saved to layout metadata.

**Standard renderers and their declared properties:**

| Renderer | Default for | Declared Properties |
|---|---|---|
| TextInput | text/varchar | maxLength, pattern (regex) |
| TextArea | — (manual pick) | rows (default: 3), maxLength |
| NumberInput | numeric types | decimals (2), min, max, showCommas (true) |
| DatePicker | date types | format (MM/DD/YYYY), minDate, maxDate, showTime (false) |
| Checkbox | boolean | (none) |
| Select | — (manual pick) | allowBlank (true), sortOptions (false), options (key:label pairs) |
| Lookup | — (manual pick) | varies per lookup component (see below) |

**Lookup renderers** — each is a separate component that knows how to search, display, and return values:

| Lookup | Declared Properties |
|---|---|
| ActiveUserLookup | multiple (false), filter (active), showEmail (true), minChars (2) |
| VendorLookup | multiple (false), filter (active), showCode (true), minChars (2) |
| CostCenterLookup | multiple (false), minChars (1) |
| AccountLookup | multiple (false), minChars (1) |
| SiteLookup | multiple (false) |
| GroupLookup | multiple (false) |

The lookup registry is extensible — ISS adds product lookups, customers can register their own. Adding a new renderer or lookup is just writing the component and declaring its properties. The designer automatically discovers and presents them.

**Example: field properties slide-in for a lookup field**


**Example: field properties slide-in for a number field**


This property list will evolve as new renderers are added. The architecture is self-describing — each component declares what it supports, no central registry to maintain.

## Unplaced Fields

When database fields exist (created in Entity Designer) but haven't been placed on the screen yet, they appear in the "Add Field" slide-in as available fields. The admin picks which unplaced field to add and where to put it.

A field can exist in the database and never be placed on any screen — it's still queryable and accessible via the API, just not visible on the form.

## Approval Forms — Auto-Provided UI

Forms with approvals enabled automatically get platform-provided UI elements that are NOT managed by the Screen Layout Designer:

### Status Strip (top of form, always visible)
```
┌──────────────────────────────────────────────────────────┐
│ Status: NOT SUBMITTED  Requestor: FRANK  Date: 2021-02-19│ Submit │
└──────────────────────────────────────────────────────────┘
```
- Standard layout, same on every approval form
- Not configurable, not moveable
- Submit button visibility controlled by business rules (status, permissions)

### Approval History Tab
- Auto-added as the second tab (after the first form tab)
- Not removable, not renameable
- Shows approval audit trail

The admin designs everything else — the first tab's sections and fields, any additional tabs, child table tabs.

## Domain Scoping

All layout configuration is per-domain:

- **Wildcard (\*)** — default configuration that applies to all domains
- **Specific domain** — overrides the wildcard for that domain only

Example: Field "Tax ID" might be mandatory in domain A but optional in domain B. Different labels in different domains. Different sections visible per domain.

Admin can switch domain context to configure each domain's layout independently. Wildcard serves as the base, domain-specific config overlays it.

## Child Table Grids

Child tables appear as tabs on the parent form. Each child tab shows a grid/browse. Grid configuration is also done in design mode:

- Which columns are visible
- Column order
- Column widths
- Default sort column and direction
- Column labels (can differ from field labels on the edit form)

Clicking a row in the child grid opens the child edit form in a slide-in panel (see Section 1 — stacking slide-in behavior).
