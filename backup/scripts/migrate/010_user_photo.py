"""
010_user_photo.py — Add photo_url column to users table.
Stores a relative path to the uploaded photo.
Idempotent: safe to re-run.
"""
import argparse, psycopg2

SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'photo_url'
    ) THEN
        ALTER TABLE users ADD COLUMN photo_url text NOT NULL DEFAULT '';
    END IF;
END $$;
"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pg-host", default="localhost")
    ap.add_argument("--pg-port", type=int, default=5432)
    ap.add_argument("--pg-db", default="isolutions")
    ap.add_argument("--pg-user", default="ipurchase")
    ap.add_argument("--pg-password", default="ipurchase")
    args = ap.parse_args()

    conn = psycopg2.connect(host=args.pg_host, port=args.pg_port,
                            dbname=args.pg_db, user=args.pg_user,
                            password=args.pg_password)
    conn.autocommit = False
    cur = conn.cursor()
    print(f"Connecting to {args.pg_host}:{args.pg_port}/{args.pg_db}...")
    cur.execute(SQL)
    conn.commit()
    print("Done — photo_url column added to users.")

if __name__ == "__main__":
    main()
