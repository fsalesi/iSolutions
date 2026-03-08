"""
005 — Make oid the primary key on all CRUD-managed tables.

Tables affected: pasoe_brokers, users, audit_log, grid_defaults,
                 grid_user_prefs, saved_filters, notifications

Tables skipped:  notes, note_attachments, note_mentions (no CRUD pages)
"""
import psycopg2, os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://ipurchase:ipurchase@localhost:5432/isolutions")

def run():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    # Tables that get oid as PK, with their current PK columns
    tables = {
        "pasoe_brokers":  "id",
        "users":          "user_id",
        "audit_log":      "id",
        "notifications":  "id",
        "saved_filters":  "id",
    }

    # Composite PK tables
    composite_tables = {
        "grid_defaults":   ["grid_id"],
        "grid_user_prefs": ["grid_id", "user_id"],
    }

    for table, old_pk in tables.items():
        print(f"\n── {table} ──")

        # Ensure no null oids
        cur.execute(f"UPDATE {table} SET oid = gen_random_uuid() WHERE oid IS NULL")

        # Make oid NOT NULL
        cur.execute(f"ALTER TABLE {table} ALTER COLUMN oid SET NOT NULL")

        # Drop old PK constraint
        cur.execute(f"""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = '{table}' AND constraint_type = 'PRIMARY KEY'
        """)
        row = cur.fetchone()
        if row:
            print(f"  Dropping old PK: {row[0]}")
            cur.execute(f"ALTER TABLE {table} DROP CONSTRAINT {row[0]}")

        # Add oid as PK
        cur.execute(f"ALTER TABLE {table} ADD PRIMARY KEY (oid)")
        print(f"  Added PRIMARY KEY (oid)")

        # Keep old column unique if it was the PK (except serial 'id' which is just a sequence)
        if old_pk == "user_id":
            cur.execute(f"""
                DO $$ BEGIN
                    ALTER TABLE {table} ADD CONSTRAINT {table}_{old_pk}_unique UNIQUE ({old_pk});
                EXCEPTION WHEN duplicate_table THEN NULL;
                END $$;
            """)
            print(f"  Added UNIQUE on {old_pk}")

    for table, old_pk_cols in composite_tables.items():
        print(f"\n── {table} ──")

        cur.execute(f"UPDATE {table} SET oid = gen_random_uuid() WHERE oid IS NULL")
        cur.execute(f"ALTER TABLE {table} ALTER COLUMN oid SET NOT NULL")

        cur.execute(f"""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = '{table}' AND constraint_type = 'PRIMARY KEY'
        """)
        row = cur.fetchone()
        if row:
            print(f"  Dropping old PK: {row[0]}")
            cur.execute(f"ALTER TABLE {table} DROP CONSTRAINT {row[0]}")

        cur.execute(f"ALTER TABLE {table} ADD PRIMARY KEY (oid)")
        print(f"  Added PRIMARY KEY (oid)")

        # Keep old composite as unique
        cols = ", ".join(old_pk_cols)
        constraint_name = f"{table}_{'_'.join(old_pk_cols)}_unique"
        cur.execute(f"""
            DO $$ BEGIN
                ALTER TABLE {table} ADD CONSTRAINT {constraint_name} UNIQUE ({cols});
            EXCEPTION WHEN duplicate_table THEN NULL;
            END $$;
        """)
        print(f"  Added UNIQUE on ({cols})")

    # Also update any FKs pointing to old PKs
    # note_attachments.note_id -> notes.id (notes table not changed, fine)
    # note_mentions.note_id -> notes.id (notes table not changed, fine)
    # notifications references notes table (not changed, fine)

    print("\n✅ All CRUD tables now use oid as primary key")
    cur.close()
    conn.close()

if __name__ == "__main__":
    run()
