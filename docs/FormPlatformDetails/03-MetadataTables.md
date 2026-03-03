# 3. Metadata Tables

> These tables power the Entity Designer, Screen Layout Designer, FormPage, and CrudRoute. They ARE the form platform's configuration database.

## Two Layers

**Schema layer** (Entity Designer) — global, same across all domains:
- What forms exist, what tables they have, what fields are on each table
- Drives CREATE TABLE / ALTER TABLE generation

**Layout layer** (Screen Layout Designer) — per-domain with wildcard defaults:
- How fields are arranged on screen, which tab, which section, what renderer
- Domain = `*` means default for all domains; specific domain overrides

---

## Schema Layer (Entity Designer)

### forms

Top-level form registration. One row per form in the system.

```sql
CREATE TABLE forms (
  oid             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key        TEXT NOT NULL UNIQUE,       -- slug: "suppliers", "requisitions"
  form_name       TEXT NOT NULL,              -- display: "Suppliers", "Requisitions"
  has_approvals   BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  is_generated    BOOLEAN NOT NULL DEFAULT false,  -- has Generate been run?
  menu_category   TEXT,                       -- which menu group to place in
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT
);
```

### form_tables

Tables within a form. Header + children. Relationships discovered by `oid_<parent>` FK convention, but this table tracks which tables belong to which form.

```sql
CREATE TABLE form_tables (
  oid             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key        TEXT NOT NULL REFERENCES forms(form_key),
  table_name      TEXT NOT NULL,              -- PG table name: "suppliers", "supplier_addresses"
  is_header       BOOLEAN NOT NULL DEFAULT false,  -- one header per form
  parent_table    TEXT,                       -- null for header, parent table_name for children
  tab_label       TEXT,                       -- display name for child tab: "Addresses", "Contacts"
  sort_order      INTEGER NOT NULL DEFAULT 0, -- child tab display order
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT,
  UNIQUE(form_key, table_name)
);
```

### form_fields

Field definitions. One row per column per table. This is the schema — what gets generated as CREATE TABLE / ALTER TABLE.

```sql
CREATE TABLE form_fields (
  oid             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key        TEXT NOT NULL,
  table_name      TEXT NOT NULL,
  field_name      TEXT NOT NULL,              -- PG column name
  data_type       TEXT NOT NULL,              -- text, integer, numeric, boolean, date, timestamp, uuid, attachment, jsonb
  max_length      INTEGER,                    -- for text
  precision       INTEGER,                    -- for numeric
  scale           INTEGER,                    -- for numeric
  is_nullable     BOOLEAN NOT NULL DEFAULT true,
  is_indexed      BOOLEAN NOT NULL DEFAULT false,
  is_unique       BOOLEAN NOT NULL DEFAULT false,
  is_copyable     BOOLEAN NOT NULL DEFAULT true,   -- included when copying records
  default_value   TEXT,                       -- SQL default expression
  sort_order      INTEGER NOT NULL DEFAULT 0, -- field creation order
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT,
  UNIQUE(form_key, table_name, field_name),
  FOREIGN KEY (form_key, table_name) REFERENCES form_tables(form_key, table_name)
);
```

**Note:** Standard fields (oid, domain, created_at, created_by, updated_at, updated_by, custom_fields, copied_from) are NOT stored here. They're added automatically during generation. Only user-defined fields appear in form_fields.

---

## Layout Layer (Screen Layout Designer)

### form_layout

Single table for all layout elements — tabs, sections, fields, and grid columns. Per-domain with `*` wildcard defaults.

```sql
CREATE TABLE form_layout (
  oid             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain          TEXT NOT NULL DEFAULT '*',  -- * = all domains, or specific
  form_key        TEXT NOT NULL REFERENCES forms(form_key),
  layout_type     TEXT NOT NULL,              -- 'tab', 'section', 'field', 'grid_column'
  layout_key      TEXT NOT NULL,              -- tab_key, section_key, field_name, or field_name (grid)
  parent_key      TEXT,                       -- field → section, section → tab, tab → null
  table_name      TEXT,                       -- which table (for child tabs, fields, grid columns)
  sort_order      INTEGER NOT NULL DEFAULT 0,
  properties      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT,
  UNIQUE(domain, form_key, layout_type, table_name, layout_key)
);

CREATE INDEX idx_form_layout_lookup ON form_layout(form_key, domain, layout_type);
```

### Layout Types and Their Properties

**tab** — a tab on the form
```json
{
  "label": "General",
  "tab_type": "header",         // header / child / attachment
  "is_visible": true
}
```
- `parent_key`: null
- `table_name`: null for header tabs, child table name for child/attachment tabs

**section** — a section within a tab
```json
{
  "label": "Address Information",
  "column_count": 2,            // 1-4 column grid
  "is_visible": true,
  "is_collapsible": false
}
```
- `parent_key`: tab's layout_key
- `table_name`: null (inherits from tab)

**field** — a field placed in a section
```json
{
  "label": "Tax ID",
  "col_span": 1,
  "placeholder": "XX-XXXXXXX",
  "help_text": "Federal tax identification number",
  "is_visible": true,
  "mandatory": "before_submit",   // never / always / before_submit
  "read_only": "never",           // never / always / after_submit
  "default_value": null,
  "searchable": false,
  "renderer": "TextInput",
  "renderer_props": { "maxLength": 20, "pattern": "\\d{2}-\\d{7}" }
}
```
- `parent_key`: section's layout_key
- `table_name`: which table this field belongs to
- `layout_key`: matches form_fields.field_name

**grid_column** — a column in a child table's browse grid
```json
{
  "label": "Street Address",
  "column_width": null,           // px or flex (null = auto)
  "is_visible": true,
  "searchable": false
}
```
- `parent_key`: null (belongs to the child table, not a section)
- `table_name`: the child table
- `layout_key`: field_name to show as column

### Parent Chain

```
tab (parent_key: null)
  └── section (parent_key: tab.layout_key)
        └── field (parent_key: section.layout_key)

grid_column — flat, keyed by table_name
```

### Domain Override Resolution

```
function resolveLayout(form_key, domain):
  -- Get all layout rows, prefer specific domain over wildcard
  SELECT DISTINCT ON (layout_type, table_name, layout_key)
    *
  FROM form_layout
  WHERE form_key = ?
    AND domain IN (?, '*')
  ORDER BY layout_type, table_name, layout_key,
    CASE WHEN domain = ? THEN 0 ELSE 1 END
```

Field-level granularity: a domain override on one field doesn't require overriding the entire layout. Unoverridden fields fall back to `*`.

---

## Attachment Configuration

### platform_attachment_types

Defined in Section 11. Stored per form, per table, with security and behavior.

```sql
CREATE TABLE platform_attachment_types (
  oid             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain          TEXT NOT NULL DEFAULT '*',
  form_key        TEXT NOT NULL REFERENCES forms(form_key),
  table_name      TEXT NOT NULL,              -- which table (header or child)
  source          TEXT NOT NULL,              -- 'field' or 'tab'
  type_code       TEXT NOT NULL,              -- "w9", "internal", "external"
  type_label      TEXT NOT NULL,
  max_count       INTEGER,                    -- null = unlimited, 1 = single file
  mandatory       TEXT NOT NULL DEFAULT 'never',   -- never / always / before_submit
  accept          TEXT,                       -- allowed MIME types: ".pdf,.jpg,.png"
  view_access     TEXT DEFAULT '*',           -- users/groups who can view
  upload_access   TEXT DEFAULT '*',           -- users/groups who can upload
  delete_access   TEXT DEFAULT '*',           -- users/groups who can delete
  print_on_output BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT,
  UNIQUE(domain, form_key, table_name, type_code)
);
```

### platform_attachments

The actual files. Shared by all forms.

```sql
CREATE TABLE platform_attachments (
  oid             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,              -- table name
  entity_oid      UUID NOT NULL,              -- record oid
  attachment_type TEXT NOT NULL,              -- type_code from platform_attachment_types
  file_name       TEXT NOT NULL,
  file_type       TEXT,                       -- MIME type
  file_size       BIGINT,
  file_data       BYTEA,                      -- or path to file storage
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT
);

CREATE INDEX idx_attachments_entity ON platform_attachments(domain, entity_type, entity_oid);
CREATE INDEX idx_attachments_type ON platform_attachments(domain, entity_type, attachment_type);
```

---

## Summary — 6 Metadata Tables

| Table | Layer | Purpose |
|---|---|---|
| forms | Schema | Form registration |
| form_tables | Schema | Tables within a form (header + children) |
| form_fields | Schema | Field definitions (drives DDL generation) |
| form_layout | Layout | All UI layout: tabs, sections, fields, grid columns (per-domain) |
| platform_attachment_types | Attachments | Type definitions with security |
| platform_attachments | Attachments | Actual files |

Plus the existing notes/note_attachments/note_mentions tables (already built, platform-wide).

---

## Runtime Resolution

### How FormPage loads a form:

```
1. Query forms WHERE form_key = 'suppliers'
2. Query form_tables WHERE form_key = 'suppliers' ORDER BY sort_order
3. Query form_layout WHERE form_key = 'suppliers' AND domain IN (current_domain, '*')
   → DISTINCT ON to prefer specific domain, fall back to *
   → Returns tabs, sections, fields, grid_columns in one query
4. Query platform_attachment_types for attachment config
5. Build tree: tabs → sections → fields from parent_key chain
6. Render using renderer + renderer_props from each field's properties
```

### How CrudRoute handles a request:

```
1. Query form_tables WHERE form_key = 'suppliers' AND is_header = true
   → get table_name for SQL
2. Query form_fields WHERE form_key = 'suppliers' AND table_name = 'suppliers'
   → get column definitions for SELECT, INSERT, UPDATE
3. Query form_layout WHERE layout_type = 'field' AND properties->>'searchable' = 'true'
   → build filterable columns for browse
4. Domain filter always applied from session context
5. Standard fields (oid, domain, audit) handled by engine — not from metadata
```

---

## What Gets Created on First Generate

When an admin clicks "Generate" in the Entity Designer:

1. **Database tables** — CREATE TABLE for header + all children, with standard fields + user-defined fields
2. **page.tsx** in `src/app/forms/<form>/` — extends FormPage, minimal
3. **route.ts** in `src/app/forms/<form>/` — extends CrudRoute, sets table name
4. **page.tsx** in `customer/forms/<form>/` — extends src version, empty shim
5. **route.ts** in `customer/forms/<form>/` — extends src version, empty shim
6. **Menu entry** — in configured category
7. **Default layout** — auto-generates form_layout rows:
   - One "General" tab (layout_type = 'tab')
   - One section per table (layout_type = 'section')
   - All fields placed in order (layout_type = 'field'), default renderers based on data_type
   - Grid columns for child tables (layout_type = 'grid_column'), all fields visible
8. **forms.is_generated** → true

The default layout gives you a working form immediately. The Screen Layout Designer then lets you refine it.
