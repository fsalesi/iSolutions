#!/usr/bin/env python3
"""Migration 013: Add native OID parent links for form platform tables.

Goal:
- forms -> form_tables via form_tables.oid_forms
- forms -> form_layout via form_layout.oid_forms
- form_tables -> form_fields via form_fields.oid_form_tables

This enables generic parentOid-based InlineCrud hierarchy without route hacks.
Idempotent and safe to re-run.
"""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

# Add columns
cur.execute("ALTER TABLE form_tables ADD COLUMN IF NOT EXISTS oid_forms uuid")
cur.execute("ALTER TABLE form_layout ADD COLUMN IF NOT EXISTS oid_forms uuid")
cur.execute("ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS oid_form_tables uuid")
print("✓ parent OID columns ensured")

# Backfill
cur.execute(
    """
    UPDATE form_tables ft
    SET oid_forms = f.oid
    FROM forms f
    WHERE ft.oid_forms IS NULL
      AND ft.form_key = f.form_key
    """
)
cur.execute(
    """
    UPDATE form_layout fl
    SET oid_forms = f.oid
    FROM forms f
    WHERE fl.oid_forms IS NULL
      AND fl.form_key = f.form_key
    """
)
cur.execute(
    """
    UPDATE form_fields ff
    SET oid_form_tables = ft.oid
    FROM form_tables ft
    WHERE ff.oid_form_tables IS NULL
      AND ff.form_key = ft.form_key
      AND ff.table_name = ft.table_name
    """
)
print("✓ parent OID values backfilled")

# FKs
cur.execute(
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_tables_oid_forms_fkey') THEN
        ALTER TABLE form_tables
          ADD CONSTRAINT form_tables_oid_forms_fkey
          FOREIGN KEY (oid_forms) REFERENCES forms(oid)
          ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$;
    """
)
cur.execute(
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_layout_oid_forms_fkey') THEN
        ALTER TABLE form_layout
          ADD CONSTRAINT form_layout_oid_forms_fkey
          FOREIGN KEY (oid_forms) REFERENCES forms(oid)
          ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$;
    """
)
cur.execute(
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_fields_oid_form_tables_fkey') THEN
        ALTER TABLE form_fields
          ADD CONSTRAINT form_fields_oid_form_tables_fkey
          FOREIGN KEY (oid_form_tables) REFERENCES form_tables(oid)
          ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$;
    """
)
print("✓ FK constraints ensured")

# Indexes
cur.execute("CREATE INDEX IF NOT EXISTS idx_form_tables_oid_forms ON form_tables(oid_forms)")
cur.execute("CREATE INDEX IF NOT EXISTS idx_form_layout_oid_forms ON form_layout(oid_forms)")
cur.execute("CREATE INDEX IF NOT EXISTS idx_form_fields_oid_form_tables ON form_fields(oid_form_tables)")
print("✓ parent OID indexes ensured")

# Sync triggers
cur.execute(
    """
    CREATE OR REPLACE FUNCTION form_tables_sync_parent_oid()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (NEW.form_key IS NULL OR NEW.form_key = '') AND NEW.oid_forms IS NOT NULL THEN
        SELECT f.form_key INTO NEW.form_key FROM forms f WHERE f.oid = NEW.oid_forms LIMIT 1;
      END IF;

      IF NEW.oid_forms IS NULL AND NEW.form_key IS NOT NULL AND NEW.form_key <> '' THEN
        SELECT f.oid INTO NEW.oid_forms FROM forms f WHERE f.form_key = NEW.form_key LIMIT 1;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_form_tables_sync_parent_oid ON form_tables;
    CREATE TRIGGER trg_form_tables_sync_parent_oid
      BEFORE INSERT OR UPDATE ON form_tables
      FOR EACH ROW EXECUTE FUNCTION form_tables_sync_parent_oid();
    """
)

cur.execute(
    """
    CREATE OR REPLACE FUNCTION form_layout_sync_parent_oid()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (NEW.form_key IS NULL OR NEW.form_key = '') AND NEW.oid_forms IS NOT NULL THEN
        SELECT f.form_key INTO NEW.form_key FROM forms f WHERE f.oid = NEW.oid_forms LIMIT 1;
      END IF;

      IF NEW.oid_forms IS NULL AND NEW.form_key IS NOT NULL AND NEW.form_key <> '' THEN
        SELECT f.oid INTO NEW.oid_forms FROM forms f WHERE f.form_key = NEW.form_key LIMIT 1;
      END IF;

      IF NEW.domain IS NULL OR NEW.domain = '' THEN
        NEW.domain := '*';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_form_layout_sync_parent_oid ON form_layout;
    CREATE TRIGGER trg_form_layout_sync_parent_oid
      BEFORE INSERT OR UPDATE ON form_layout
      FOR EACH ROW EXECUTE FUNCTION form_layout_sync_parent_oid();
    """
)

cur.execute(
    """
    CREATE OR REPLACE FUNCTION form_fields_sync_parent_oid()
    RETURNS TRIGGER AS $$
    BEGIN
      IF ((NEW.form_key IS NULL OR NEW.form_key = '') OR (NEW.table_name IS NULL OR NEW.table_name = ''))
         AND NEW.oid_form_tables IS NOT NULL THEN
        SELECT ft.form_key, ft.table_name INTO NEW.form_key, NEW.table_name
        FROM form_tables ft
        WHERE ft.oid = NEW.oid_form_tables
        LIMIT 1;
      END IF;

      IF NEW.oid_form_tables IS NULL
         AND NEW.form_key IS NOT NULL AND NEW.form_key <> ''
         AND NEW.table_name IS NOT NULL AND NEW.table_name <> '' THEN
        SELECT ft.oid INTO NEW.oid_form_tables
        FROM form_tables ft
        WHERE ft.form_key = NEW.form_key
          AND ft.table_name = NEW.table_name
        LIMIT 1;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_form_fields_sync_parent_oid ON form_fields;
    CREATE TRIGGER trg_form_fields_sync_parent_oid
      BEFORE INSERT OR UPDATE ON form_fields
      FOR EACH ROW EXECUTE FUNCTION form_fields_sync_parent_oid();
    """
)
print("✓ parent OID sync triggers ensured")

cur.close()
conn.close()
print("\n✅ Migration 013 complete")
