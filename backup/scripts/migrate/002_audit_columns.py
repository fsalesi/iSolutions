#!/usr/bin/env python3
"""
002_audit_columns.py - Add standard audit columns to all tables.

Every table gets:
  - oid         UUID  NOT NULL DEFAULT gen_random_uuid()  (UNIQUE, immutable)
  - created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - created_by  citext NOT NULL DEFAULT ''
  - updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - updated_by  citext NOT NULL DEFAULT ''

Also adds a trigger to auto-set updated_at on UPDATE.
Idempotent: safe to re-run.
"""

import argparse
import psycopg2

AUDIT_COLUMNS = {
    "oid":        "UUID NOT NULL DEFAULT gen_random_uuid()",
    "created_at": "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    "created_by": "citext NOT NULL DEFAULT \'\'",
    "updated_at": "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    "updated_by": "citext NOT NULL DEFAULT \'\'",
}

TABLES = [
    "users",
    "pasoe_brokers",
    "grid_defaults",
    "grid_user_prefs",
    "saved_filters",
]

TRIGGER_FUNC = """
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def trigger_ddl(table):
    return f"""
DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};
CREATE TRIGGER trg_{table}_updated_at
    BEFORE UPDATE ON {table}
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
"""


def main():
    parser = argparse.ArgumentParser(description="Add audit columns + OID to all tables")
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

    # Create the trigger function
    print("Creating set_updated_at() trigger function...")
    cur.execute(TRIGGER_FUNC)

    for table in TABLES:
        print(f"\n-- {table} --")

        # Get existing columns
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
        """, (table,))
        existing = {row[0] for row in cur.fetchall()}

        for col, typedef in AUDIT_COLUMNS.items():
            if col in existing:
                print(f"  {col}: already exists, skipping")
            else:
                sql = f"ALTER TABLE {table} ADD COLUMN {col} {typedef};"
                print(f"  {col}: ADDING")
                if not args.dry_run:
                    cur.execute(sql)

        # Add UNIQUE constraint on oid if not already there
        cur.execute("""
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = %s AND constraint_type = 'UNIQUE'
              AND constraint_name = %s
        """, (table, f"{table}_oid_key"))
        if cur.fetchone():
            print(f"  oid UNIQUE constraint: already exists")
        else:
            sql = f"ALTER TABLE {table} ADD CONSTRAINT {table}_oid_key UNIQUE (oid);"
            print(f"  oid UNIQUE constraint: ADDING")
            if not args.dry_run:
                cur.execute(sql)

        # Backfill any NULL oids
        if not args.dry_run:
            cur.execute(f"UPDATE {table} SET oid = gen_random_uuid() WHERE oid IS NULL;")

        # Add updated_at trigger
        print(f"  updated_at trigger: creating")
        if not args.dry_run:
            cur.execute(trigger_ddl(table))

    if args.dry_run:
        print("\nDRY RUN - rolling back")
        conn.rollback()
    else:
        conn.commit()
        print("\nCommitted!")

    # Verify
    print("\n-- Verification --")
    for table in TABLES:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
              AND column_name IN ('oid', 'created_at', 'created_by', 'updated_at', 'updated_by')
            ORDER BY column_name
        """, (table,))
        cols = [r[0] for r in cur.fetchall()]
        ok = "OK" if len(cols) == 5 else "MISSING"
        print(f"  {table}: {", ".join(cols)}  {ok}")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
