#!/usr/bin/env python3
"""Migration 011: Create groups and group_members tables.

groups - Group definitions with nested group support
group_members - Junction table supporting both user and group members
"""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

# ── groups table ──────────────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS groups (
  group_id        citext NOT NULL DEFAULT '',
  description     citext NOT NULL DEFAULT '',
  is_active       boolean NOT NULL DEFAULT true,

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  PRIMARY KEY (oid),
  UNIQUE (group_id)
);
""")
print("✓ groups table created")

cur.execute("COMMENT ON COLUMN groups.group_id IS 'Group ID';")
cur.execute("COMMENT ON COLUMN groups.description IS 'Description';")
cur.execute("COMMENT ON COLUMN groups.is_active IS 'Active';")

cur.execute("CREATE INDEX IF NOT EXISTS idx_groups_group_id ON groups(group_id);")

cur.execute("""
    CREATE OR REPLACE FUNCTION groups_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_groups_updated_at ON groups;
    CREATE TRIGGER trg_groups_updated_at
        BEFORE UPDATE ON groups
        FOR EACH ROW EXECUTE FUNCTION groups_set_updated_at();
""")
print("✓ groups trigger created")

# ── group_members table ───────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS group_members (
  group_id        citext NOT NULL DEFAULT '',
  member_id       citext NOT NULL DEFAULT '',
  is_excluded     boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  PRIMARY KEY (oid),
  UNIQUE (group_id, member_id)
);
""")
print("✓ group_members table created")

cur.execute("COMMENT ON COLUMN group_members.group_id IS 'Group';")
cur.execute("COMMENT ON COLUMN group_members.member_id IS 'Member';")
cur.execute("COMMENT ON COLUMN group_members.is_excluded IS 'Excluded';")

cur.execute("CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_group_members_member ON group_members(member_id);")

cur.execute("""
    CREATE OR REPLACE FUNCTION group_members_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_group_members_updated_at ON group_members;
    CREATE TRIGGER trg_group_members_updated_at
        BEFORE UPDATE ON group_members
        FOR EACH ROW EXECUTE FUNCTION group_members_set_updated_at();
""")
print("✓ group_members trigger created")

cur.close()
conn.close()
print("\n✅ Migration 011 complete")
