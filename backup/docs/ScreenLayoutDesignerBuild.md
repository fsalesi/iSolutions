# Screen Layout Designer — Build Task List

> Live design mode on running forms. Admins click fields, sections, and tabs
> to edit properties in a slide-in panel. All changes write to `form_layout`.

## What Already Exists

- **form_layout table** — domain, form_key, table_name, layout_type, layout_key,
  parent_key, sort_order, properties (jsonb). PK: (domain, form_key, layout_type, table_name, layout_key).
- **layout-generator.ts** — Entity Designer's Generate creates default layout rows
  (tabs, sections, fields, grid_columns) for every field. 34 rows created for POReq.
  Never overwrites existing rows.
- **form_layout API** — `/api/form_layout/route.ts` (basic CRUD already exists).
- **FormPage.tsx** (528 lines) — already renders from layout metadata:
  - `FormDetailTabs` → tabs from layout
  - `HeaderTabContent` → sections → fields from layout
  - `FieldRenderer` → renders by `properties.renderer` (text, number, date, checkbox, textarea, select)
  - `ChildGrid` → child table grids
- **SlidePanel** component — already exists and used elsewhere.

## Build Steps

### Step 1 — Design Mode Toggle & Visual Indicators ✅
- [x] Add `designMode` state to FormPage
- [x] Gear/pencil icon in form toolbar (admin-only, check user role)
- [x] Thread `designMode` prop through FormDetailTabs → HeaderTabContent
- [x] In design mode: dashed borders on sections, hover highlight on fields
- [x] CSS: `.design-mode-field:hover` subtle blue border, cursor pointer
- [x] "Done" button to exit design mode
- [x] Design mode disabled on new/unsaved records

### Step 2 — Field Properties Slide-in ✅
- [x] Click field in design mode → open SlidePanel with field properties
- [x] Properties form:
  - [x] Label (text input)
  - [x] Renderer (select: text, textarea, number, date, datetime, checkbox, select, lookup)
  - [x] Col-span (select: 1, 2, 3, 4 — capped at section column count)
  - [x] Mandatory (select: never, always, on_submit)
  - [x] Read-only (select: never, always, after_submit)
  - [x] Default value (text input)
  - [x] Placeholder (text input)
  - [x] Help text / tooltip (text input)
  - [x] Searchable (checkbox — controls grid_column visibility)
  - [x] Hidden (checkbox — hides from form but field still in DB)
- [x] Save → PATCH/PUT to form_layout API → update properties jsonb
- [x] Cancel → close slide-in, discard changes
- [x] Live preview: form behind slide-in updates on save
- [ ] Delete field from layout (removes from form, not from DB)

### Step 3 — Section Management ✅
- [x] Click section header in design mode → SlidePanel
- [x] Edit label
- [x] Column count (1, 2, 3, 4)
- [x] Move to different tab (select from existing tabs)
- [x] Reorder within tab (sort_order)
- [x] Delete section (with confirmation — moves fields to "unplaced")
- [x] "Add Section" button visible in design mode
  - [x] Name, target tab, column count
  - [x] Creates new form_layout row (layout_type = "section")

### Step 4 — Tab Management ✅
- [x] Click tab label in design mode → SlidePanel
- [x] Edit label
- [x] Reorder (sort_order)
- [x] Delete tab (with confirmation — moves sections/fields to "unplaced")
- [x] "Add Tab" button visible in design mode
  - [x] Name the tab
  - [x] Creates new form_layout row (layout_type = "tab")
- [x] Cannot delete last remaining tab

### Step 5 — Add Field (Unplaced Fields) ✅
- [x] "Add Field" button visible in design mode
- [x] SlidePanel shows list of database fields NOT in any layout
  - [x] Query: form_fields WHERE field NOT IN form_layout for this form
  - [x] Show field_name, data_type for each
- [x] Pick field → assign to section → set position (sort_order)
- [x] Auto-select renderer based on data_type (reuse layout-generator logic)
- [x] Creates new form_layout row (layout_type = "field")

### Step 6 — Reorder Fields Within Section ✅
- [x] In design mode, fields show position number or drag handles
- [x] Change sort_order via field properties slide-in (Step 2)
- [x] Move field to different section via field properties slide-in
- [x] Future: drag-and-drop reorder (nice-to-have, not MVP)

### Step 7 — Grid Column Designer ✅
- [x] In design mode on the browse grid, columns are editable
- [x] Click column header → SlidePanel: label, width, sort default, visible
- [x] Add/remove columns from browse grid
- [x] Reorder grid columns (sort_order)
- [x] Child grid columns also configurable
- [x] Grid column entries = layout_type "grid_column" in form_layout

### Step 8 — Renderer-Specific Properties
- [ ] Each renderer declares its configurable props with defaults
- [ ] Field properties slide-in dynamically shows renderer-specific fields
- [ ] Standard renderer properties:
  - [ ] TextInput: maxLength, pattern (regex)
  - [ ] TextArea: rows (default: 3), maxLength
  - [ ] NumberInput: decimals (2), min, max, showCommas (true)
  - [ ] DatePicker: format, minDate, maxDate, showTime (false)
  - [ ] Checkbox: (none beyond base)
  - [ ] Select: allowBlank, sortOptions, options (key:label pairs)
- [ ] Only overridden values saved to properties jsonb (sparse storage)

### Step 9 — Lookup Renderers
- [ ] Lookup renderer type in field properties
- [ ] Lookup-specific properties panel:
  - [ ] ActiveUserLookup: multiple, filter, showEmail, minChars
  - [ ] VendorLookup: multiple, filter, showCode, minChars
  - [ ] CostCenterLookup: multiple, minChars
  - [ ] AccountLookup: multiple, minChars
  - [ ] SiteLookup: multiple
  - [ ] GroupLookup: multiple
- [ ] Lookup registry pattern — self-describing components
- [ ] ISS can add product lookups, customers can register their own

### Step 10 — Domain Scoping
- [ ] Domain selector in design mode toolbar
- [ ] Wildcard (*) = default for all domains
- [ ] Specific domain overrides wildcard
- [ ] FormPage render: merge wildcard + domain-specific layout at runtime
- [ ] Designer shows which properties are inherited vs overridden

### Step 11 — Layout API Enhancements
- [ ] Endpoint: GET unplaced fields for a form
- [ ] Endpoint: Bulk reorder (accept array of {oid, sort_order})
- [ ] Endpoint: Move field to section (update parent_key + sort_order)
- [ ] Endpoint: Move section to tab (update parent_key + sort_order)
- [ ] All endpoints filter by domain

### Step 12 — End-to-End Test
- [ ] Open POReq form → enter design mode
- [ ] Click field → edit label → save → verify label updated on form
- [ ] Change renderer → verify field renders differently
- [ ] Add new section → add unplaced field to it
- [ ] Add new tab → move section to new tab
- [ ] Edit grid columns → verify browse grid updates
- [ ] Reorder fields → verify order changes
- [ ] Delete field from layout → verify it disappears (but DB column stays)
- [ ] Re-generate in Entity Designer → verify customizations preserved

## Architecture Notes

- All layout data in `form_layout` table, keyed by (domain, form_key)
- `layout-generator.ts` seeds defaults on Generate, never overwrites
- FormPage reads layout at runtime — no code generation for UI
- Design mode is an overlay on the running form, not a separate screen
- One slide-in at a time — save/cancel returns to design mode
- Changes take effect immediately (no publish step)
