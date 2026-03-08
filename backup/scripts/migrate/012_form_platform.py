#!/usr/bin/env python3
"""Migration 012: Create Form Platform metadata tables.

6 tables:
  forms                    - Form registration (one row per form)
  form_tables              - Tables within a form (header + children)
  form_fields              - Field definitions (drives DDL generation)
  form_layout              - UI layout: tabs, sections, fields, grid columns (per-domain)
  platform_attachment_types - Attachment type definitions with security
  platform_attachments     - Actual file storage

Idempotent: safe to re-run.
"""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

# ── forms ──────────────────────────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS forms (
  form_key        citext NOT NULL DEFAULT '',
  form_name       citext NOT NULL DEFAULT '',
  description     citext NOT NULL DEFAULT '',
  has_approvals   boolean NOT NULL DEFAULT false,
  is_generated    boolean NOT NULL DEFAULT false,
  last_generated_at timestamptz,
  needs_generate  boolean NOT NULL DEFAULT false,
  menu_category   citext NOT NULL DEFAULT '',

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  PRIMARY KEY (oid),
  UNIQUE (form_key)
);
""")
print("✓ forms table created")

cur.execute("COMMENT ON COLUMN forms.form_key IS 'Form Key';")
cur.execute("COMMENT ON COLUMN forms.form_name IS 'Form Name';")
cur.execute("COMMENT ON COLUMN forms.description IS 'Description';")
cur.execute("COMMENT ON COLUMN forms.has_approvals IS 'Approvals';")
cur.execute("COMMENT ON COLUMN forms.is_generated IS 'Generated';")
cur.execute("COMMENT ON COLUMN forms.last_generated_at IS 'Timestamp of last successful schema generation';")
cur.execute("COMMENT ON COLUMN forms.menu_category IS 'Menu Category';")

cur.execute("""
    CREATE OR REPLACE FUNCTION forms_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_forms_updated_at ON forms;
    CREATE TRIGGER trg_forms_updated_at
        BEFORE UPDATE ON forms
        FOR EACH ROW EXECUTE FUNCTION forms_set_updated_at();
""")
print("✓ forms trigger created")

# ── form_tables ────────────────────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS form_tables (
  form_key        citext NOT NULL DEFAULT '',
  table_name      citext NOT NULL DEFAULT '',
  is_header       boolean NOT NULL DEFAULT false,
  parent_table    citext NOT NULL DEFAULT '',
  tab_label       citext NOT NULL DEFAULT '',
  sort_order      integer NOT NULL DEFAULT 0,
  has_attachments boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  PRIMARY KEY (oid),
  UNIQUE (form_key, table_name),
  FOREIGN KEY (form_key) REFERENCES forms(form_key) ON UPDATE CASCADE ON DELETE CASCADE
);
""")
print("✓ form_tables table created")

cur.execute("COMMENT ON COLUMN form_tables.form_key IS 'Form';")
cur.execute("COMMENT ON COLUMN form_tables.table_name IS 'Table Name';")
cur.execute("COMMENT ON COLUMN form_tables.is_header IS 'Header';")
cur.execute("COMMENT ON COLUMN form_tables.parent_table IS 'Parent Table';")
cur.execute("COMMENT ON COLUMN form_tables.tab_label IS 'Tab Label';")
cur.execute("COMMENT ON COLUMN form_tables.sort_order IS 'Sort Order';")
cur.execute("COMMENT ON COLUMN form_tables.has_attachments IS 'Enable attachments on this table';")

cur.execute("CREATE INDEX IF NOT EXISTS idx_form_tables_form_key ON form_tables(form_key);")

cur.execute("""
    CREATE OR REPLACE FUNCTION form_tables_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_form_tables_updated_at ON form_tables;
    CREATE TRIGGER trg_form_tables_updated_at
        BEFORE UPDATE ON form_tables
        FOR EACH ROW EXECUTE FUNCTION form_tables_set_updated_at();
""")
print("✓ form_tables trigger created")

# ── form_fields ────────────────────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS form_fields (
  form_key        citext NOT NULL DEFAULT '',
  table_name      citext NOT NULL DEFAULT '',
  field_name      citext NOT NULL DEFAULT '',
  data_type       citext NOT NULL DEFAULT 'text',
  max_length      integer,
  precision       integer,
  scale           integer,
  is_nullable     boolean NOT NULL DEFAULT true,
  default_value   citext NOT NULL DEFAULT '',
  is_indexed      boolean NOT NULL DEFAULT false,
  is_unique       boolean NOT NULL DEFAULT false,
  is_copyable     boolean NOT NULL DEFAULT true,
  case_sensitive   boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  PRIMARY KEY (oid),
  UNIQUE (form_key, table_name, field_name),
  FOREIGN KEY (form_key, table_name) REFERENCES form_tables(form_key, table_name) ON UPDATE CASCADE ON DELETE CASCADE
);
""")
print("✓ form_fields table created")

cur.execute("COMMENT ON COLUMN form_fields.form_key IS 'Form';")
cur.execute("COMMENT ON COLUMN form_fields.table_name IS 'Table';")
cur.execute("COMMENT ON COLUMN form_fields.field_name IS 'Field Name';")
cur.execute("COMMENT ON COLUMN form_fields.data_type IS 'Data Type';")
cur.execute("COMMENT ON COLUMN form_fields.max_length IS 'Max Length';")
cur.execute("COMMENT ON COLUMN form_fields.precision IS 'Precision';")
cur.execute("COMMENT ON COLUMN form_fields.scale IS 'Scale';")
cur.execute("COMMENT ON COLUMN form_fields.is_nullable IS 'Nullable';")
cur.execute("COMMENT ON COLUMN form_fields.default_value IS 'Default Value';")
cur.execute("COMMENT ON COLUMN form_fields.is_indexed IS 'Indexed';")
cur.execute("COMMENT ON COLUMN form_fields.is_unique IS 'Unique';")
cur.execute("COMMENT ON COLUMN form_fields.is_copyable IS 'Copyable';")
cur.execute("COMMENT ON COLUMN form_fields.case_sensitive IS 'Case sensitive (true=text, false=citext)';")
cur.execute("COMMENT ON COLUMN form_fields.sort_order IS 'Sort Order';")

cur.execute("CREATE INDEX IF NOT EXISTS idx_form_fields_table ON form_fields(form_key, table_name);")

cur.execute("""
    CREATE OR REPLACE FUNCTION form_fields_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_form_fields_updated_at ON form_fields;
    CREATE TRIGGER trg_form_fields_updated_at
        BEFORE UPDATE ON form_fields
        FOR EACH ROW EXECUTE FUNCTION form_fields_set_updated_at();
""")
print("✓ form_fields trigger created")

# ── form_layout ────────────────────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS form_layout (
  domain          citext NOT NULL DEFAULT '*',
  form_key        citext NOT NULL DEFAULT '',
  table_name      citext NOT NULL DEFAULT '',
  layout_type     citext NOT NULL DEFAULT '',
  layout_key      citext NOT NULL DEFAULT '',
  parent_key      citext NOT NULL DEFAULT '',
  sort_order      integer NOT NULL DEFAULT 0,
  properties      jsonb NOT NULL DEFAULT '{}',

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  PRIMARY KEY (oid),
  UNIQUE (domain, form_key, layout_type, table_name, layout_key),
  FOREIGN KEY (form_key) REFERENCES forms(form_key) ON UPDATE CASCADE ON DELETE CASCADE
);
""")
print("✓ form_layout table created")

cur.execute("COMMENT ON COLUMN form_layout.domain IS 'Domain';")
cur.execute("COMMENT ON COLUMN form_layout.form_key IS 'Form';")
cur.execute("COMMENT ON COLUMN form_layout.table_name IS 'Table';")
cur.execute("COMMENT ON COLUMN form_layout.layout_type IS 'Layout Type';")
cur.execute("COMMENT ON COLUMN form_layout.layout_key IS 'Layout Key';")
cur.execute("COMMENT ON COLUMN form_layout.parent_key IS 'Parent Key';")
cur.execute("COMMENT ON COLUMN form_layout.sort_order IS 'Sort Order';")
cur.execute("COMMENT ON COLUMN form_layout.properties IS 'Properties';")

cur.execute("CREATE INDEX IF NOT EXISTS idx_form_layout_lookup ON form_layout(form_key, domain, layout_type);")

cur.execute("""
    CREATE OR REPLACE FUNCTION form_layout_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_form_layout_updated_at ON form_layout;
    CREATE TRIGGER trg_form_layout_updated_at
        BEFORE UPDATE ON form_layout
        FOR EACH ROW EXECUTE FUNCTION form_layout_set_updated_at();
""")
print("✓ form_layout trigger created")

# ── platform_attachment_types ──────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS platform_attachment_types (
  domain          citext NOT NULL DEFAULT '*',
  form_key        citext NOT NULL DEFAULT '',
  table_name      citext NOT NULL DEFAULT '',
  source          citext NOT NULL DEFAULT 'tab',
  type_code       citext NOT NULL DEFAULT '',
  type_label      citext NOT NULL DEFAULT '',
  max_count       integer,
  mandatory       citext NOT NULL DEFAULT 'never',
  accept          citext NOT NULL DEFAULT '',
  view_access     citext NOT NULL DEFAULT '*',
  upload_access   citext NOT NULL DEFAULT '*',
  delete_access   citext NOT NULL DEFAULT '*',
  print_on_output boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  PRIMARY KEY (oid),
  UNIQUE (domain, form_key, table_name, type_code),
  FOREIGN KEY (form_key) REFERENCES forms(form_key) ON UPDATE CASCADE ON DELETE CASCADE
);
""")
print("✓ platform_attachment_types table created")

cur.execute("COMMENT ON COLUMN platform_attachment_types.domain IS 'Domain';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.form_key IS 'Form';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.table_name IS 'Table';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.source IS 'Source';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.type_code IS 'Type Code';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.type_label IS 'Type Label';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.max_count IS 'Max Count';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.mandatory IS 'Mandatory';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.accept IS 'Accepted Types';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.view_access IS 'View Access';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.upload_access IS 'Upload Access';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.delete_access IS 'Delete Access';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.print_on_output IS 'Print on Output';")
cur.execute("COMMENT ON COLUMN platform_attachment_types.sort_order IS 'Sort Order';")

cur.execute("""
    CREATE OR REPLACE FUNCTION platform_attachment_types_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_platform_attachment_types_updated_at ON platform_attachment_types;
    CREATE TRIGGER trg_platform_attachment_types_updated_at
        BEFORE UPDATE ON platform_attachment_types
        FOR EACH ROW EXECUTE FUNCTION platform_attachment_types_set_updated_at();
""")
print("✓ platform_attachment_types trigger created")

# ── platform_attachments ───────────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS platform_attachments (
  domain          citext NOT NULL DEFAULT '',
  entity_type     citext NOT NULL DEFAULT '',
  entity_oid      uuid NOT NULL,
  attachment_type citext NOT NULL DEFAULT '',
  file_name       citext NOT NULL DEFAULT '',
  file_type       citext NOT NULL DEFAULT '',
  file_size       bigint NOT NULL DEFAULT 0,
  file_data       bytea,
  description     citext NOT NULL DEFAULT '',

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  PRIMARY KEY (oid)
);
""")
print("✓ platform_attachments table created")

cur.execute("COMMENT ON COLUMN platform_attachments.domain IS 'Domain';")
cur.execute("COMMENT ON COLUMN platform_attachments.entity_type IS 'Entity Type';")
cur.execute("COMMENT ON COLUMN platform_attachments.entity_oid IS 'Entity OID';")
cur.execute("COMMENT ON COLUMN platform_attachments.attachment_type IS 'Attachment Type';")
cur.execute("COMMENT ON COLUMN platform_attachments.file_name IS 'File Name';")
cur.execute("COMMENT ON COLUMN platform_attachments.file_type IS 'File Type';")
cur.execute("COMMENT ON COLUMN platform_attachments.file_size IS 'File Size';")
cur.execute("COMMENT ON COLUMN platform_attachments.file_data IS 'File Data';")
cur.execute("COMMENT ON COLUMN platform_attachments.description IS 'Description';")

cur.execute("CREATE INDEX IF NOT EXISTS idx_platform_attachments_entity ON platform_attachments(domain, entity_type, entity_oid);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_platform_attachments_type ON platform_attachments(domain, entity_type, attachment_type);")

cur.execute("""
    CREATE OR REPLACE FUNCTION platform_attachments_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_platform_attachments_updated_at ON platform_attachments;
    CREATE TRIGGER trg_platform_attachments_updated_at
        BEFORE UPDATE ON platform_attachments
        FOR EACH ROW EXECUTE FUNCTION platform_attachments_set_updated_at();
""")
print("✓ platform_attachments trigger created")

cur.close()
conn.close()
print("\n✅ Migration 012 complete")
