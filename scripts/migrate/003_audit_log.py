#!/usr/bin/env python3
"""
003_audit_log.py — Create the audit_log table and trigger for change tracking.

Creates:
  - audit_log table to capture every INSERT/UPDATE/DELETE
  - audit_log_notify() trigger function that logs field-level changes
  - Triggers on: users, pasoe_brokers (add more tables to AUDITED_TABLES)

Each row in audit_log captures:
  - table_name, record_oid (the oid UUID of the record that changed)
  - action (INSERT/UPDATE/DELETE)
  - field_name, old_value, new_value (one row per changed field on UPDATE)
  - changed_by, changed_at

Idempotent: safe to re-run.

Usage:
    python3 003_audit_log.py \
        --pg-host localhost --pg-port 5432 --pg-db isolutions \
        --pg-user ipurchase --pg-password ipurchase
"""

import argparse
import psycopg2

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGSERIAL       PRIMARY KEY,
    table_name      citext          NOT NULL,
    record_oid      UUID            NOT NULL,
    action          citext          NOT NULL,
    field_name      citext,
    old_value       TEXT,
    new_value       TEXT,
    changed_by      citext          NOT NULL DEFAULT '',
    changed_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Standard audit columns (per ARCHITECTURE.md)
    oid             UUID            NOT NULL DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      citext          NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_by      citext          NOT NULL DEFAULT ''
);
"""

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_audit_log_record
    ON audit_log (table_name, record_oid, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
    ON audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by
    ON audit_log (changed_by) WHERE changed_by != '';
"""

UNIQUE_OID = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'audit_log' AND constraint_name = 'audit_log_oid_key'
    ) THEN
        ALTER TABLE audit_log ADD CONSTRAINT audit_log_oid_key UNIQUE (oid);
    END IF;
END $$;
"""

COMMENT = "COMMENT ON TABLE audit_log IS 'Field-level change audit trail for all audited tables';"

# The trigger function that does the actual logging.
# On INSERT: one row per record with action='INSERT', no field detail.
# On DELETE: one row per record with action='DELETE', no field detail.
# On UPDATE: one row per changed field showing old/new values.
# Skips audit columns (updated_at, updated_by) to reduce noise.
TRIGGER_FUNC = """
CREATE OR REPLACE FUNCTION audit_log_notify()
RETURNS TRIGGER AS $$
DECLARE
    v_oid       UUID;
    v_user      citext;
    v_old_val   TEXT;
    v_new_val   TEXT;
    v_col       TEXT;
    v_skip      TEXT[] := ARRAY['updated_at', 'updated_by', 'created_at', 'created_by', 'oid', 'photo', 'photo_type'];
    v_cols       TEXT[];
    v_has_change BOOLEAN := FALSE;
BEGIN
    -- Determine the record OID
    IF TG_OP = 'DELETE' THEN
        v_oid := OLD.oid;
        v_user := COALESCE(OLD.updated_by, '');
    ELSE
        v_oid := NEW.oid;
        v_user := COALESCE(NEW.updated_by, '');
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_oid, action, changed_by)
        VALUES (TG_TABLE_NAME, v_oid, 'INSERT', v_user);
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_oid, action, changed_by)
        VALUES (TG_TABLE_NAME, v_oid, 'DELETE', v_user);
        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Get all column names for this table
        SELECT array_agg(column_name::text)
        INTO v_cols
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = TG_TABLE_NAME;

        -- Compare each column
        FOREACH v_col IN ARRAY v_cols LOOP
            -- Skip audit meta-columns
            IF v_col = ANY(v_skip) THEN
                CONTINUE;
            END IF;

            -- Use hstore to get old/new values by column name
            EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_col, v_col)
                INTO v_old_val, v_new_val
                USING OLD, NEW;

            -- Only log if value actually changed (handle NULLs, treat '' same as NULL)
            IF COALESCE(v_old_val, '') IS DISTINCT FROM COALESCE(v_new_val, '') THEN
                INSERT INTO audit_log (table_name, record_oid, action, field_name, old_value, new_value, changed_by)
                VALUES (TG_TABLE_NAME, v_oid, 'UPDATE', v_col, v_old_val, v_new_val, v_user);
                v_has_change := TRUE;
            END IF;
        END LOOP;

        -- If no fields changed (only audit columns), still log a touch
        IF NOT v_has_change THEN
            INSERT INTO audit_log (table_name, record_oid, action, field_name, changed_by)
            VALUES (TG_TABLE_NAME, v_oid, 'UPDATE', NULL, v_user);
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
"""

# Tables to audit — add more here as needed
AUDITED_TABLES = ["users", "pasoe_brokers", "settings"]


def trigger_ddl(table):
    return f"""
DROP TRIGGER IF EXISTS trg_{table}_audit ON {table};
CREATE TRIGGER trg_{table}_audit
    AFTER INSERT OR UPDATE OR DELETE ON {table}
    FOR EACH ROW EXECUTE FUNCTION audit_log_notify();
"""


def main():
    parser = argparse.ArgumentParser(description="Create audit_log table and triggers")
    parser.add_argument("--pg-host", default="localhost")
    parser.add_argument("--pg-port", type=int, default=5432)
    parser.add_argument("--pg-db", default="isolutions")
    parser.add_argument("--pg-user", default="ipurchase")
    parser.add_argument("--pg-password", default="ipurchase")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Connecting to PostgreSQL {args.pg_host}:{args.pg_port}/{args.pg_db}...")
    conn = psycopg2.connect(
        host=args.pg_host, port=args.pg_port, dbname=args.pg_db,
        user=args.pg_user, password=args.pg_password,
    )
    conn.autocommit = False
    cur = conn.cursor()

    # Ensure citext extension
    conn.autocommit = True
    cur.execute("CREATE EXTENSION IF NOT EXISTS citext;")
    conn.autocommit = False

    # Create table
    print("Creating audit_log table...")
    cur.execute(CREATE_TABLE)
    cur.execute(CREATE_INDEXES)
    cur.execute(UNIQUE_OID)
    cur.execute(COMMENT)

    # Create set_updated_at trigger for audit_log itself
    print("Adding set_updated_at trigger to audit_log...")
    cur.execute("""
        DROP TRIGGER IF EXISTS trg_audit_log_updated_at ON audit_log;
        CREATE TRIGGER trg_audit_log_updated_at
            BEFORE UPDATE ON audit_log
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    """)

    # Create the audit trigger function
    print("Creating audit_log_notify() trigger function...")
    cur.execute(TRIGGER_FUNC)

    # Attach to audited tables
    for table in AUDITED_TABLES:
        print(f"Attaching audit trigger to {table}...")
        if not args.dry_run:
            cur.execute(trigger_ddl(table))

    if args.dry_run:
        print("\nDRY RUN — rolling back")
        conn.rollback()
    else:
        conn.commit()
        print("\nCommitted!")

    # Verify
    print("\n-- Verification --")
    cur.execute("""
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_name LIKE 'trg_%_audit'
        ORDER BY event_object_table
    """)
    for row in cur.fetchall():
        print(f"  Trigger {row[0]} on {row[1]}")

    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'audit_log' AND table_schema = 'public'
        ORDER BY ordinal_position
    """)
    cols = [r[0] for r in cur.fetchall()]
    print(f"  audit_log columns: {', '.join(cols)}")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
