#!/usr/bin/env python3
"""Migration 009: Create settings table."""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS settings (
  -- Business columns
  owner           text NOT NULL DEFAULT 'SYSTEM',
  setting_name    text NOT NULL DEFAULT '',
  domain          text NOT NULL DEFAULT '*',
  app             text NOT NULL DEFAULT '',
  value           text NOT NULL DEFAULT '',
  help_text       text NOT NULL DEFAULT '',

  -- Standard columns (MANDATORY on every table)
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  -- PK is ALWAYS oid
  PRIMARY KEY (oid),

  -- Natural key
  UNIQUE (owner, setting_name, domain, app)
);
""")
print("✓ settings table created")

# Indexes
cur.execute("CREATE INDEX IF NOT EXISTS idx_settings_name ON settings(setting_name);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_settings_owner ON settings(owner);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_settings_domain ON settings(domain);")
print("✓ indexes created")

# Auto-update trigger
cur.execute("""
    CREATE OR REPLACE FUNCTION settings_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
    CREATE TRIGGER trg_settings_updated_at
        BEFORE UPDATE ON settings
        FOR EACH ROW EXECUTE FUNCTION settings_set_updated_at();
""")
print("✓ updated_at trigger created")

# Column comments
cur.execute("COMMENT ON COLUMN settings.owner IS 'Owner';")
cur.execute("COMMENT ON COLUMN settings.setting_name IS 'Setting Name';")
cur.execute("COMMENT ON COLUMN settings.domain IS 'Domain';")
cur.execute("COMMENT ON COLUMN settings.app IS 'Application';")
cur.execute("COMMENT ON COLUMN settings.value IS 'Value';")
cur.execute("COMMENT ON COLUMN settings.help_text IS 'Help Text';")
print("✓ column comments added")

cur.close()
conn.close()
print("\n✅ Migration 009 complete")
