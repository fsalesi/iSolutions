#!/usr/bin/env python3
"""Migration 007: Convert date columns to timestamptz.

Per DATEPICKER-SPEC.md, all dates stored as timestamptz (even date-only fields).
Date-only fields store as midnight UTC.
"""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

# Convert expire_date from date → timestamptz
cur.execute("""
    ALTER TABLE users
    ALTER COLUMN expire_date TYPE timestamptz
    USING expire_date::timestamptz;
""")
print("✓ users.expire_date → timestamptz")

# Convert last_login from date → timestamptz
cur.execute("""
    ALTER TABLE users
    ALTER COLUMN last_login TYPE timestamptz
    USING last_login::timestamptz;
""")
print("✓ users.last_login → timestamptz")

cur.close()
conn.close()
print("\n✅ Migration 007 complete")
