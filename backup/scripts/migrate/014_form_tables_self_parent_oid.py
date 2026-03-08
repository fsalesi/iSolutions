#!/usr/bin/env python3
"""Migration 014: Add self-parent OID link on form_tables.

Adds form_tables.oid_parent_table -> form_tables.oid to represent table hierarchy
at OID level (in addition to parent_table text).
"""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

cur.execute("ALTER TABLE form_tables ADD COLUMN IF NOT EXISTS oid_parent_table uuid")

cur.execute(
    """
    UPDATE form_tables child
    SET oid_parent_table = parent.oid
    FROM form_tables parent
    WHERE child.form_key = parent.form_key
      AND child.parent_table = parent.table_name
      AND child.parent_table <> ''
      AND child.oid_parent_table IS NULL
    """
)

cur.execute(
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_tables_oid_parent_table_fkey') THEN
        ALTER TABLE form_tables
          ADD CONSTRAINT form_tables_oid_parent_table_fkey
          FOREIGN KEY (oid_parent_table) REFERENCES form_tables(oid)
          ON UPDATE CASCADE ON DELETE SET NULL;
      END IF;
    END $$;
    """
)

cur.execute("CREATE INDEX IF NOT EXISTS idx_form_tables_oid_parent_table ON form_tables(oid_parent_table)")

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

      IF (NEW.parent_table IS NULL OR NEW.parent_table = '') AND NEW.oid_parent_table IS NOT NULL THEN
        SELECT p.table_name INTO NEW.parent_table FROM form_tables p WHERE p.oid = NEW.oid_parent_table LIMIT 1;
      END IF;

      IF NEW.oid_parent_table IS NULL
         AND NEW.parent_table IS NOT NULL AND NEW.parent_table <> ''
         AND NEW.form_key IS NOT NULL AND NEW.form_key <> '' THEN
        SELECT p.oid INTO NEW.oid_parent_table
        FROM form_tables p
        WHERE p.form_key = NEW.form_key
          AND p.table_name = NEW.parent_table
        LIMIT 1;
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

cur.close()
conn.close()
print("✅ Migration 014 complete")
