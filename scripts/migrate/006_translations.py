#!/usr/bin/env python3
"""Migration 006: Create locales and translations tables."""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS locales (
  code            text NOT NULL UNIQUE,
  description     text NOT NULL DEFAULT '',
  date_format     text NOT NULL DEFAULT 'mdy',
  decimal_char    text NOT NULL DEFAULT '.',
  separator_char  text NOT NULL DEFAULT ',',
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),
  PRIMARY KEY (oid)
);
""")
print("✓ locales table created")

cur.execute("""
CREATE TABLE IF NOT EXISTS translations (
  locale          text NOT NULL REFERENCES locales(code),
  namespace       text NOT NULL DEFAULT 'global',
  key             text NOT NULL,
  value           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),
  PRIMARY KEY (oid),
  UNIQUE (locale, namespace, key)
);
""")
print("✓ translations table created")

# Create indexes
cur.execute("CREATE INDEX IF NOT EXISTS idx_translations_locale ON translations(locale);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_translations_ns ON translations(locale, namespace);")
print("✓ indexes created")

# Add audit triggers
for table in ["locales", "translations"]:
    cur.execute(f"""
        CREATE OR REPLACE FUNCTION {table}_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};
        CREATE TRIGGER trg_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION {table}_set_updated_at();
    """)
print("✓ audit triggers created")

# Seed default locale
cur.execute("""
INSERT INTO locales (code, description, date_format, decimal_char, separator_char, is_default, created_by)
VALUES
  ('en-us', 'English (US)', 'mdy', '.', ',', true, 'system'),
  ('en-uk', 'English (UK)', 'dmy', ',', '.', false, 'system'),
  ('es',    'Spanish',       'dmy', '.', ',', false, 'system'),
  ('fr',    'French',        'ymd', ',', '', false, 'system'),
  ('de',    'German',        'ymd', ',', '.', false, 'system')
ON CONFLICT (code) DO NOTHING;
""")
print("✓ default locales seeded")

cur.close()
conn.close()
print("\n✅ Migration 006 complete")
