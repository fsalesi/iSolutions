#!/usr/bin/env python3
"""Migration 014: Refactor approval_roles table.

Changes:
  1. Rename dimension_type -> scope_type
  2. Rename dimension_value -> scope_value
  3. Drop hardcoded CHECK constraint on dimension_type (now driven by system setting)
  4. Insert system setting APPROVALS_ROLE_SCOPE_TYPES

Idempotent: safe to re-run.
"""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

# ── 1. Rename dimension_type -> scope_type ────────────────────────────────────
cur.execute("""
    DO $$ BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'approval_roles' AND column_name = 'dimension_type'
        ) THEN
            ALTER TABLE approval_roles RENAME COLUMN dimension_type TO scope_type;
        END IF;
    END $$;
""")
print("✓ Renamed dimension_type -> scope_type")

# ── 2. Rename dimension_value -> scope_value ──────────────────────────────────
cur.execute("""
    DO $$ BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'approval_roles' AND column_name = 'dimension_value'
        ) THEN
            ALTER TABLE approval_roles RENAME COLUMN dimension_value TO scope_value;
        END IF;
    END $$;
""")
print("✓ Renamed dimension_value -> scope_value")

# ── 3. Drop check constraint ──────────────────────────────────────────────────
cur.execute("""
    DO $$ BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'approval_roles' AND constraint_name = 'chk_dimension_type'
        ) THEN
            ALTER TABLE approval_roles DROP CONSTRAINT chk_dimension_type;
        END IF;
    END $$;
""")
print("✓ Dropped CHECK constraint chk_dimension_type")

# ── 4. Update unique constraint to use new column names ───────────────────────
# Drop old unique constraint (references old column names in its definition name)
cur.execute("""
    DO $$ BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'approval_roles'
              AND constraint_name = 'approval_roles_domain_role_name_dimension_type_dimension_va_key'
        ) THEN
            ALTER TABLE approval_roles
                DROP CONSTRAINT approval_roles_domain_role_name_dimension_type_dimension_va_key;
        END IF;
    END $$;
""")
# Re-add with clean name
cur.execute("""
    DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'approval_roles'
              AND constraint_name = 'approval_roles_natural_key'
        ) THEN
            ALTER TABLE approval_roles
                ADD CONSTRAINT approval_roles_natural_key
                UNIQUE (domain, role_name, scope_type, scope_value);
        END IF;
    END $$;
""")
print("✓ Rebuilt unique constraint as approval_roles_natural_key")

# ── 5. Update lookup index to use new column names ────────────────────────────
cur.execute("DROP INDEX IF EXISTS idx_approval_roles_lookup;")
cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_approval_roles_lookup
        ON approval_roles (domain, role_name, scope_type, scope_value)
        WHERE is_active = true;
""")
print("✓ Rebuilt idx_approval_roles_lookup index")

# ── 6. Insert system setting APPROVALS_ROLE_SCOPE_TYPES ──────────────────────
cur.execute("""
    INSERT INTO settings (owner, setting_name, domain, form, value, help_text, created_by, updated_by)
    VALUES (
        'SYSTEM',
        'APPROVALS_ROLE_SCOPE_TYPES',
        '*',
        '',
        'COST_CENTER,ACCOUNT,PROJECT,SITE,SUB_ACCOUNT',
        'Comma-separated list of scope types available when assigning users to approval roles. '
        'Each type corresponds to a requisition line-level field. '
        'Customers can restrict or reorder this list per domain.',
        'system',
        'system'
    )
    ON CONFLICT (owner, setting_name, domain, form) DO NOTHING;
""")
print("✓ Inserted system setting APPROVALS_ROLE_SCOPE_TYPES")

cur.close()
conn.close()
print("\nMigration 014 complete.")
