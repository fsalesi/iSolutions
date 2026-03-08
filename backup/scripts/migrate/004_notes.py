#!/usr/bin/env python3
"""
004_notes.py — Notes, attachments, mentions, and notifications tables.
Idempotent: safe to re-run.
"""

import psycopg2
import os

CONN = dict(
    host=os.getenv("PGHOST", "localhost"),
    port=os.getenv("PGPORT", "5432"),
    dbname=os.getenv("PGDATABASE", "isolutions"),
    user=os.getenv("PGUSER", "ipurchase"),
    password=os.getenv("PGPASSWORD", "ipurchase"),
)

def run():
    conn = psycopg2.connect(**CONN)
    conn.autocommit = True
    cur = conn.cursor()

    # ── notes ────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id          BIGSERIAL PRIMARY KEY,
            table_name  citext      NOT NULL,
            record_oid  UUID        NOT NULL,
            body        text        NOT NULL,
            author      citext      NOT NULL,
            oid         UUID        NOT NULL DEFAULT gen_random_uuid(),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by  citext      NOT NULL DEFAULT '',
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by  citext      NOT NULL DEFAULT '',
            CONSTRAINT notes_oid_key UNIQUE (oid)
        );
    """)
    print("✓ notes table")

    # Indexes
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_notes_record
        ON notes (table_name, record_oid, created_at DESC);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_notes_author
        ON notes (author);
    """)

    # updated_at trigger
    cur.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.triggers
                WHERE trigger_name = 'trg_notes_updated_at'
                  AND event_object_table = 'notes'
            ) THEN
                CREATE TRIGGER trg_notes_updated_at
                    BEFORE UPDATE ON notes
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
            END IF;
        END $$;
    """)
    print("✓ notes indexes + trigger")

    # ── note_attachments ─────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS note_attachments (
            id          BIGSERIAL PRIMARY KEY,
            note_id     BIGINT      NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            filename    citext      NOT NULL,
            mime_type   citext      NOT NULL,
            file_data   BYTEA       NOT NULL,
            file_size   INTEGER     NOT NULL,
            oid         UUID        NOT NULL DEFAULT gen_random_uuid(),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by  citext      NOT NULL DEFAULT '',
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by  citext      NOT NULL DEFAULT '',
            CONSTRAINT note_attachments_oid_key UNIQUE (oid)
        );
    """)
    print("✓ note_attachments table")

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_note_attachments_note
        ON note_attachments (note_id);
    """)

    cur.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.triggers
                WHERE trigger_name = 'trg_note_attachments_updated_at'
                  AND event_object_table = 'note_attachments'
            ) THEN
                CREATE TRIGGER trg_note_attachments_updated_at
                    BEFORE UPDATE ON note_attachments
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
            END IF;
        END $$;
    """)
    print("✓ note_attachments indexes + trigger")

    # ── note_mentions ────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS note_mentions (
            note_id     BIGINT  NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            user_id     citext  NOT NULL,
            PRIMARY KEY (note_id, user_id)
        );
    """)
    print("✓ note_mentions table")

    # ── notifications ────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id          BIGSERIAL PRIMARY KEY,
            user_id     citext      NOT NULL,
            note_id     BIGINT      NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            table_name  citext      NOT NULL,
            record_oid  UUID        NOT NULL,
            is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
            deleted_at  TIMESTAMPTZ,
            oid         UUID        NOT NULL DEFAULT gen_random_uuid(),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by  citext      NOT NULL DEFAULT '',
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by  citext      NOT NULL DEFAULT '',
            CONSTRAINT notifications_oid_key UNIQUE (oid)
        );
    """)
    print("✓ notifications table")

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON notifications (user_id, is_read, deleted_at);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_note
        ON notifications (note_id);
    """)

    cur.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.triggers
                WHERE trigger_name = 'trg_notifications_updated_at'
                  AND event_object_table = 'notifications'
            ) THEN
                CREATE TRIGGER trg_notifications_updated_at
                    BEFORE UPDATE ON notifications
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
            END IF;
        END $$;
    """)
    print("✓ notifications indexes + trigger")

    cur.close()
    conn.close()
    print("\n✅ Migration 004_notes complete.")

if __name__ == "__main__":
    run()
