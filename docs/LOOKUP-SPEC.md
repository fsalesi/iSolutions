# Lookup Component Specification

## Overview

A universal search/select component that handles small dropdowns, type-ahead autocomplete, and full browse-modal grids. Supports single and multi-select, cascading field population, and pluggable data sources (local PostgreSQL or remote QAD/ERP).

## Architecture

### Three Layers

```
┌─────────────────────────────────────────────────┐
│  Page                                           │
│  field("supervisor_id", {                       │
│    type: "lookup",                              │
│    lookup: UserLookup({ onSelect: ... })        │  ← page overrides
│  })                                             │
├─────────────────────────────────────────────────┤
│  Library Preset (e.g. UserLookup)               │
│  - api/fetch config                             │
│  - valueField, displayField                     │  ← pre-configured
│  - searchColumns, gridColumns                   │
│  - default data source (PG or QAD)              │
├─────────────────────────────────────────────────┤
│  <Lookup /> Component                           │
│  - Text input with dropdown                     │
│  - Debounced search                             │  ← generic engine
│  - Browse modal (reuses DataGrid)               │
│  - Single / multi-select                        │
│  - Cascade via onSelect callback                │
└─────────────────────────────────────────────────┘
```

### Inheritance Model

Every preset is just a config object. Pages merge overrides on top.

```tsx
// Library defines preset
export const UserLookup = (overrides?: Partial<LookupConfig>) => ({
  apiPath: "/api/users",
  valueField: "user_id",
  displayField: "full_name",
  searchColumns: ["user_id", "full_name", "email"],
  gridColumns: [
    { key: "user_id", label: "ID" },
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
  ],
  ...overrides,
});

// Page uses it with overrides
{field("supervisor_id", {
  type: "lookup",
  lookup: UserLookup({
    onSelect: (record) => {
      onChange("supervisor_name", record.full_name);
    },
  }),
})}
```

## Component: `<Lookup />`

### Behavior

1. **Idle** — Shows stored value's display text (or the raw value if no display mapping).
2. **Typing** — Debounced search (300ms). Dropdown appears with matching results.
3. **Dropdown** — Shows top N results. Each row shows display field + optional secondary text. Click to select. Keyboard nav (↑↓ Enter Esc).
4. **Browse button** — Opens a modal with full DataGrid. Search, sort, filter, paginate. Click row to select and close modal.
5. **Selection** — Sets the value field on the form. Calls `onSelect(record)` for cascading. Closes dropdown/modal.
6. **Multi-select** — Shows chips. Dropdown stays open after selection. Backspace removes last chip. Stored as comma-separated or array.
7. **Clear** — X button to clear selection.

### Props (LookupConfig)

```tsx
interface LookupConfig {
  // --- Data Source (provide ONE of these) ---

  /** Local PG: API path to search (default fetch). GET with ?search=&limit= */
  apiPath?: string;

  /** Custom fetch function (overrides apiPath). For QAD or any non-standard source. */
  fetchFn?: (params: {
    search: string;
    limit: number;
    offset: number;
    domain?: string;
  }) => Promise<{ rows: any[]; total: number }>;

  // --- Field Mapping ---

  /** Field to store as the value (e.g. "user_id", "ac_acct") */
  valueField: string;

  /** Field to display in the input when a value is selected (e.g. "full_name") */
  displayField: string;

  /** Optional: format display as "{valueField} — {displayField}" */
  displayFormat?: (record: any) => string;

  /** Fields to search against when typing (default: [valueField, displayField]) */
  searchColumns?: string[];

  // --- Dropdown ---

  /** Max items in dropdown (default: 10) */
  dropdownLimit?: number;

  /** Columns shown in dropdown rows (default: [valueField, displayField]) */
  dropdownColumns?: string[];

  /** Preload all results on mount? (default: false — true for small lists < 100) */
  preload?: boolean;

  // --- Browse Modal ---

  /** Show browse button? (default: true) */
  browsable?: boolean;

  /** Grid columns for the browse modal */
  gridColumns?: ColumnDef<any>[];

  /** Browse modal title (default: "Select {label}") */
  browseTitle?: string;

  // --- Selection ---

  /** Multi-select mode (default: false) */
  multiple?: boolean;

  /** Callback when a record is selected — use for cascading other fields */
  onSelect?: (record: any) => void;

  /** Callback when selection is cleared */
  onClear?: () => void;

  // --- Display ---

  /** Placeholder text when empty */
  placeholder?: string;

  /** Read-only mode */
  readOnly?: boolean;

  /** Minimum characters before search fires (default: 1) */
  minChars?: number;
}
```

## Data Sources

### Default: Local PostgreSQL

If `apiPath` is provided, the component uses a standard GET request:

```
GET /api/users?search=fra&limit=10&offset=0
→ { rows: [...], total: 45 }
```

This works with any existing CRUD API route since they all support `search` and `limit` params already.

### Override: QAD/ERP via Proxy

For QAD data, the preset provides a `fetchFn` that calls our proxy route:

```tsx
export const AccountLookup = (overrides?: Partial<LookupConfig>) => ({
  valueField: "ac_acct",
  displayField: "ac_desc",
  searchColumns: ["ac_acct", "ac_desc"],
  gridColumns: [
    { key: "ac_acct", label: "Account" },
    { key: "ac_desc", label: "Description" },
  ],
  fetchFn: async ({ search, limit, offset, domain }) => {
    const res = await fetch("/api/qad/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        procedure: "getData.p",
        dsName: "ac_mstr",
        domain,
        whereClause: search
          ? `ac_domain eq "${domain}" and ac_desc matches "*${search}*"`
          : `ac_domain eq "${domain}"`,
        fieldSet: "ac_acct,ac_desc",
        numRecords: limit,
        startRow: offset,
      }),
    });
    const data = await res.json();
    return { rows: data.rows, total: data.total };
  },
  ...overrides,
});
```

### Override: QAD Specific Procedure

For procedures with custom entry points:

```tsx
export const POLookup = (overrides?: Partial<LookupConfig>) => ({
  valueField: "po_nbr",
  displayField: "po_nbr",
  displayFormat: (r) => `${r.po_nbr} — ${r.po_vend} (${r.po_stat})`,
  gridColumns: [
    { key: "po_nbr", label: "PO #" },
    { key: "po_vend", label: "Vendor" },
    { key: "po_stat", label: "Status" },
  ],
  fetchFn: async ({ search, limit, domain }) => {
    const res = await fetch("/api/qad/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        procedure: "bepo.p",
        entry: "beGetPODS",
        domain,
        input: search,
      }),
    });
    const data = await res.json();
    return { rows: data.rows, total: data.rows.length };
  },
  ...overrides,
});
```

## QAD Proxy Route

`/api/qad/proxy/route.ts` — thin pass-through that:

1. Accepts a normalized JSON payload from the frontend
2. Builds the QAD-format request (getData.p style or specific procedure)
3. Adds auth context (domain, userid, qadUser, qadPass from session/config)
4. POSTs to the QAD endpoint (e.g. `https://demo.salesi.net/QAD/web/api`)
5. Normalizes the response to `{ rows: [...], total: N }`

Auth context (qadUser, qadPass, endpoint URL) comes from `pasoe_brokers` table or system settings — not hardcoded and not sent from the frontend.

## Library Presets

Presets live in `src/components/lookup/presets/`:

```
src/components/lookup/
├── Lookup.tsx              ← the generic component
├── LookupBrowseModal.tsx   ← browse modal (uses DataGrid)
├── LookupTypes.ts          ← LookupConfig interface
└── presets/
    ├── index.ts            ← re-exports all presets
    ├── UserLookup.ts       ← local PG: users table
    ├── GroupLookup.ts      ← local PG: groups table
    ├── DomainLookup.ts     ← local PG or system setting: ALLOWED_DOMAINS
    ├── AccountLookup.ts    ← QAD: ac_mstr via getData.p
    ├── VendorLookup.ts     ← QAD: vd_mstr via getData.p
    ├── CostCenterLookup.ts ← QAD: cc_mstr via getData.p
    ├── PartLookup.ts       ← QAD: pt_mstr via getData.p
    ├── POLookup.ts         ← QAD: bepo.p specific procedure
    └── BuyerLookup.ts      ← local PG: users with buyer role
```

## Integration with useFieldHelper

The `field()` helper gets a new type: `"lookup"`.

```tsx
// Simple — just use the preset
{field("supervisor_id", {
  type: "lookup",
  lookup: UserLookup(),
})}

// With cascade
{field("vendor", {
  type: "lookup",
  lookup: VendorLookup({
    onSelect: (r) => {
      onChange("vendor_name", r.vd_sort);
      onChange("vendor_currency", r.vd_curr);
    },
  }),
})}

// Multi-select domain assignment
{field("domains", {
  type: "lookup",
  lookup: DomainLookup({ multiple: true }),
})}

// Override a preset at the page level
{field("account", {
  type: "lookup",
  lookup: AccountLookup({
    dropdownLimit: 20,
    gridColumns: [
      { key: "ac_acct", label: "Account" },
      { key: "ac_desc", label: "Description" },
      { key: "ac_type", label: "Type" },  // extra column for this page
    ],
  }),
})}
```

## DomainLookup — Special Case

Domains are a comma-separated list from system settings, not a table. The preset handles this:

```tsx
export const DomainLookup = (overrides?: Partial<LookupConfig>) => ({
  valueField: "code",
  displayField: "code",
  multiple: true,
  preload: true,  // always small list
  fetchFn: async () => {
    const res = await fetch("/api/system_settings?name=ALLOWED_DOMAINS");
    const data = await res.json();
    const domains = data.value.split(",").map((d: string) => d.trim());
    return {
      rows: domains.map(d => ({ code: d })),
      total: domains.length,
    };
  },
  ...overrides,
});
```

## Cascade Examples

### Supervisor with name display
```tsx
{field("supervisor_id", {
  type: "lookup",
  lookup: UserLookup({
    displayFormat: (r) => `${r.user_id} — ${r.full_name}`,
    onSelect: (r) => {
      onChange("supervisor_name", r.full_name);
      onChange("supervisor_email", r.email);
    },
  }),
})}
```

### Account with description + cost center
```tsx
{field("account", {
  type: "lookup",
  lookup: AccountLookup({
    onSelect: (r) => {
      onChange("account_desc", r.ac_desc);
      onChange("cost_center", r.ac_cc);
    },
  }),
})}
```

### Vendor populating multiple fields
```tsx
{field("vendor_code", {
  type: "lookup",
  lookup: VendorLookup({
    onSelect: (r) => {
      onChange("vendor_name", r.vd_sort);
      onChange("vendor_currency", r.vd_curr);
      onChange("payment_terms", r.vd_cr_terms);
      onChange("buyer", r.vd_buyer);
    },
  }),
})}
```

## Visual Design

### Inline (collapsed)
```
┌──────────────────────────────────┬───┐
│ frank — Frank Salesi             │ ⊞ │  ← browse button
└──────────────────────────────────┴───┘
```

### Typing (dropdown open)
```
┌──────────────────────────────────┬───┐
│ fra                              │ ⊞ │
├──────────────────────────────────┴───┤
│ frank    Frank Salesi                │  ← highlighted
│ fran2    Francesca Adams             │
│ francis  Francis K. Miller           │
└──────────────────────────────────────┘
```

### Multi-select with chips
```
┌──────────────────────────────────┬───┐
│ [demo1 ×] [demo2 ×] [dem       │ ⊞ │
├──────────────────────────────────┴───┤
│ demo3    Demo Domain 3               │
│ demo4    Demo Domain 4               │
└──────────────────────────────────────┘
```

### Browse modal
```
┌─────────────────────────────────────────┐
│  Select Supervisor                   ✕  │
├─────────────────────────────────────────┤
│  🔍 Search...                           │
├──────────┬───────────────┬──────────────┤
│  ID      │ Name          │ Email        │
├──────────┼───────────────┼──────────────┤
│  frank   │ Frank Salesi  │ frank@...    │  ← click to select
│  jane    │ Jane Doe      │ jane@...     │
│  ...     │ ...           │ ...          │
├──────────┴───────────────┴──────────────┤
│                           1-20 of 156   │
└─────────────────────────────────────────┘
```

## Implementation Order

1. `LookupTypes.ts` — interface definitions
2. `Lookup.tsx` — core component (input + dropdown + keyboard nav)
3. `LookupBrowseModal.tsx` — modal with DataGrid
4. Integration into `useFieldHelper` — `type: "lookup"` support
5. Local presets — `UserLookup`, `GroupLookup`
6. QAD proxy route — `/api/qad/proxy`
7. QAD presets — `AccountLookup`, `VendorLookup`, etc.
8. `DomainLookup` — system settings integration
9. Convert existing fields — supervisor_id, delegate_id, locale, domains

## Design Principles

- **Preset = config object, not a component.** Presets return `LookupConfig`. The component is always `<Lookup />`.
- **Override anything.** Every preset prop can be overridden at the page level.
- **fetchFn is the escape hatch.** If the data source is weird, write a custom fetchFn. The component doesn't care where data comes from.
- **Normalize everything.** QAD proxy normalizes responses to `{ rows, total }`. The component always sees the same shape.
- **Reuse DataGrid.** The browse modal is not a new grid — it's the same DataGrid with column chooser, sort, filter, export.
- **Domain-aware.** QAD lookups automatically get the user's current domain from session context.
