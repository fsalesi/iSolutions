#!/usr/bin/env python3
"""
001_users.py — Migrate wus_mstr → isolutions.users

Creates the users table (if not exists) with citext columns,
then copies all rows from the OpenEdge wus_mstr table.

Idempotent: safe to re-run. Truncates and re-inserts each time.

Usage:
    python3 001_users.py \
        --oe-host 127.0.0.1 --oe-port 20100 --oe-db wdm \
        --pg-host localhost  --pg-port 5432  --pg-db isolutions \
        --pg-user ipurchase  --pg-password ipurchase
"""

import argparse
import sys
import pyodbc
import psycopg2

# ── Schema ──────────────────────────────────────────────────────────

CREATE_EXTENSION = "CREATE EXTENSION IF NOT EXISTS citext;"

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS users (
    -- Identity
    user_id         citext       PRIMARY KEY,
    full_name       citext       NOT NULL DEFAULT '',
    email           citext       NOT NULL DEFAULT '',
    title           citext       NOT NULL DEFAULT '',
    company         citext       NOT NULL DEFAULT '',
    user_type       citext       NOT NULL DEFAULT '',

    -- Status
    is_disabled     BOOLEAN      NOT NULL DEFAULT FALSE,
    expire_date     DATE,
    last_login      DATE,
    failed_logins   INTEGER      NOT NULL DEFAULT 0,

    -- Auth
    password_hash   citext       NOT NULL DEFAULT '',
    domains         citext       NOT NULL DEFAULT '',

    -- Contact
    phone           citext       NOT NULL DEFAULT '',
    fax             citext       NOT NULL DEFAULT '',
    carrier         citext       NOT NULL DEFAULT '',
    mobile_enabled  BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Address
    street1         citext       NOT NULL DEFAULT '',
    street2         citext       NOT NULL DEFAULT '',
    city            citext       NOT NULL DEFAULT '',
    state           citext       NOT NULL DEFAULT '',
    postal_code     citext       NOT NULL DEFAULT '',
    country         citext       NOT NULL DEFAULT '',

    -- iPurchase
    supervisor_id   citext       NOT NULL DEFAULT '',
    delegate_id     citext       NOT NULL DEFAULT '',
    approval_limit  NUMERIC(15,2) NOT NULL DEFAULT 0,
    employee_number     citext       NOT NULL DEFAULT '',
    erp_initials    citext       NOT NULL DEFAULT '',

    -- Audit
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      citext       NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
"""

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_users_email      ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_supervisor  ON users (supervisor_id) WHERE supervisor_id != '';
CREATE INDEX IF NOT EXISTS idx_users_disabled    ON users (is_disabled);
"""

COMMENT = "COMMENT ON TABLE users IS 'User accounts — migrated from wus_mstr';"

# ── OpenEdge queries (split to stay under 20-column ODBC limit) ─────

OE_QUERY_1 = """
SELECT wus_id, wus_name, wus_email, wus_title, wus_company, wus_type,
       wus_disable, wus_expire_date, wus_last_login, wus_failed_logins,
       wus_password, wus_domains, wus_phone, wus_fax, wus_carrier, wus_mobile,
       wus_street1, wus_street2
FROM PUB.wus_mstr ORDER BY wus_id
"""

OE_QUERY_2 = """
SELECT wus_id, wus_city, wus_state, wus_post, wus_country,
       wus_supervisor, wus_delegate, wus_app_amt, wus_erp_id, wus_erp_initials,
       wus_create_date, wus_create_by
FROM PUB.wus_mstr ORDER BY wus_id
"""

# ── PG insert ───────────────────────────────────────────────────────

PG_INSERT = """
INSERT INTO users (
    user_id, full_name, email, title, company, user_type,
    is_disabled, expire_date, last_login, failed_logins,
    password_hash, domains, phone, fax, carrier, mobile_enabled,
    street1, street2, city, state, postal_code, country,
    supervisor_id, delegate_id, approval_limit, employee_number, erp_initials,
    created_at, created_by
) VALUES (
    %(user_id)s, %(full_name)s, %(email)s, %(title)s, %(company)s, %(user_type)s,
    %(is_disabled)s, %(expire_date)s, %(last_login)s, %(failed_logins)s,
    %(password_hash)s, %(domains)s, %(phone)s, %(fax)s, %(carrier)s, %(mobile_enabled)s,
    %(street1)s, %(street2)s, %(city)s, %(state)s, %(postal_code)s, %(country)s,
    %(supervisor_id)s, %(delegate_id)s, %(approval_limit)s, %(employee_number)s, %(erp_initials)s,
    %(created_at)s, %(created_by)s
)
"""


def s(val):
    """Coerce to string, lowercased for IDs, empty string for None."""
    if val is None:
        return ''
    return str(val)


def s_lower(val):
    """Coerce to lowercase string."""
    if val is None:
        return ''
    return str(val).lower()


def main():
    parser = argparse.ArgumentParser(description="Migrate wus_mstr → isolutions.users")
    # OpenEdge
    parser.add_argument("--oe-host", default="127.0.0.1")
    parser.add_argument("--oe-port", type=int, default=20100)
    parser.add_argument("--oe-db", default="wdm")
    parser.add_argument("--oe-user", default="frank")
    parser.add_argument("--oe-password", default="")
    # PostgreSQL
    parser.add_argument("--pg-host", default="localhost")
    parser.add_argument("--pg-port", type=int, default=5432)
    parser.add_argument("--pg-db", default="isolutions")
    parser.add_argument("--pg-user", default="ipurchase")
    parser.add_argument("--pg-password", default="ipurchase")
    # Options
    parser.add_argument("--dry-run", action="store_true", help="Read OE data but don't write to PG")

    args = parser.parse_args()

    # ── Connect to OpenEdge ─────────────────────────────────────────
    print(f"Connecting to OpenEdge {args.oe_host}:{args.oe_port}/{args.oe_db}...")
    oe_conn_str = (
        f"DRIVER={{Progress OpenEdge Driver}};"
        f"HOST={args.oe_host};PORT={args.oe_port};DB={args.oe_db};"
        f"UID={args.oe_user};PWD={args.oe_password};"
    )
    try:
        oe_conn = pyodbc.connect(oe_conn_str)
    except Exception as e:
        print(f"ERROR: Cannot connect to OpenEdge: {e}", file=sys.stderr)
        sys.exit(1)
    oe_cur = oe_conn.cursor()
    print("  Connected to OpenEdge.")

    # ── Read wus_mstr (two queries to stay under 20-col ODBC limit) ─
    print("Reading wus_mstr...")
    oe_cur.execute(OE_QUERY_1)
    batch1 = {row[0]: row for row in oe_cur.fetchall()}

    oe_cur.execute(OE_QUERY_2)
    batch2 = {row[0]: row for row in oe_cur.fetchall()}

    print(f"  Found {len(batch1)} users in OpenEdge.")

    # ── Build rows ──────────────────────────────────────────────────
    rows = []
    for uid, r1 in batch1.items():
        r2 = batch2.get(uid)
        if not r2:
            print(f"  WARNING: user '{uid}' in query 1 but not query 2, skipping.")
            continue

        create_date = r2[10]
        if create_date:
            created_at = str(create_date) + " 00:00:00+00"
        else:
            created_at = "2020-01-01 00:00:00+00"

        rows.append({
            "user_id":        s_lower(r1[0]),
            "full_name":      s(r1[1]),
            "email":          s(r1[2]),
            "title":          s(r1[3]),
            "company":        s(r1[4]),
            "user_type":      s(r1[5]),
            "is_disabled":    bool(r1[6]),
            "expire_date":    r1[7] or None,
            "last_login":     r1[8] or None,
            "failed_logins":  r1[9] or 0,
            "password_hash":  s(r1[10]),
            "domains":        s(r1[11]),
            "phone":          s(r1[12]),
            "fax":            s(r1[13]),
            "carrier":        s(r1[14]),
            "mobile_enabled": bool(r1[15]),
            "street1":        s(r1[16]),
            "street2":        s(r1[17]),
            "city":           s(r2[1]),
            "state":          s(r2[2]),
            "postal_code":    s(r2[3]),
            "country":        s(r2[4]),
            "supervisor_id":  s_lower(r2[5]),
            "delegate_id":    s_lower(r2[6]),
            "approval_limit": float(r2[7] or 0),
            "employee_number":    s_lower(r2[8]),
            "erp_initials":   s(r2[9]),
            "created_at":     created_at,
            "created_by":     s_lower(r2[11]),
        })

    oe_cur.close()
    oe_conn.close()

    if args.dry_run:
        print(f"\nDRY RUN: Would insert {len(rows)} users. Exiting.")
        return

    # ── Connect to PostgreSQL ───────────────────────────────────────
    print(f"\nConnecting to PostgreSQL {args.pg_host}:{args.pg_port}/{args.pg_db}...")
    try:
        pg_conn = psycopg2.connect(
            host=args.pg_host, port=args.pg_port, dbname=args.pg_db,
            user=args.pg_user, password=args.pg_password,
        )
    except Exception as e:
        print(f"ERROR: Cannot connect to PostgreSQL: {e}", file=sys.stderr)
        sys.exit(1)
    pg_conn.autocommit = False
    pg_cur = pg_conn.cursor()
    print("  Connected to PostgreSQL.")

    # ── Create schema ───────────────────────────────────────────────
    print("Ensuring schema exists...")
    pg_conn.autocommit = True
    pg_cur.execute(CREATE_EXTENSION)
    pg_conn.autocommit = False

    pg_cur.execute(CREATE_TABLE)
    pg_cur.execute(CREATE_INDEXES)
    pg_cur.execute(COMMENT)
    pg_conn.commit()
    print("  Schema ready.")

    # ── Truncate + insert ───────────────────────────────────────────
    print(f"Inserting {len(rows)} users...")
    pg_cur.execute("TRUNCATE TABLE users")

    for i, row in enumerate(rows):
        pg_cur.execute(PG_INSERT, row)

    pg_conn.commit()
    print(f"  Inserted {len(rows)} users.")

    # ── Verify ──────────────────────────────────────────────────────
    pg_cur.execute("SELECT COUNT(*) FROM users")
    total = pg_cur.fetchone()[0]

    pg_cur.execute("SELECT COUNT(*) FROM users WHERE is_disabled")
    disabled = pg_cur.fetchone()[0]

    pg_cur.execute("SELECT COUNT(*) FROM users WHERE approval_limit > 0")
    with_limit = pg_cur.fetchone()[0]

    print(f"\n{'='*50}")
    print(f"  Migration complete!")
    print(f"  Total users:        {total}")
    print(f"  Active:             {total - disabled}")
    print(f"  Disabled:           {disabled}")
    print(f"  With approval limit: {with_limit}")
    print(f"{'='*50}")

    pg_cur.close()
    pg_conn.close()


if __name__ == "__main__":
    main()
