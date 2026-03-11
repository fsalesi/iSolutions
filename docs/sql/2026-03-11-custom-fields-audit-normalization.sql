-- Split custom_fields audit logging into per-key audit rows.
--
-- This migration does two things:
-- 1. Updates audit_log_notify() so future UPDATEs on custom_fields write one audit row per changed key.
-- 2. Backfills existing audit_log rows where field_name = 'custom_fields' and removes the old blob rows.

CREATE OR REPLACE FUNCTION public.audit_log_notify()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_oid       UUID;
    v_user      citext;
    v_old_val   TEXT;
    v_new_val   TEXT;
    v_col       TEXT;
    v_key       TEXT;
    v_old_json  JSONB;
    v_new_json  JSONB;
    v_skip      TEXT[] := ARRAY['updated_at', 'updated_by', 'created_at', 'created_by', 'oid', 'photo', 'photo_type'];
    v_cols      TEXT[];
    v_has_change BOOLEAN := FALSE;
BEGIN
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
        SELECT array_agg(column_name::text)
        INTO v_cols
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = TG_TABLE_NAME;

        FOREACH v_col IN ARRAY v_cols LOOP
            IF v_col = ANY(v_skip) THEN
                CONTINUE;
            END IF;

            IF v_col = 'custom_fields' THEN
                EXECUTE 'SELECT ($1).custom_fields, ($2).custom_fields'
                    INTO v_old_json, v_new_json
                    USING OLD, NEW;

                v_old_json := COALESCE(v_old_json, '{}'::jsonb);
                v_new_json := COALESCE(v_new_json, '{}'::jsonb);

                FOR v_key IN
                    SELECT key
                    FROM (
                        SELECT jsonb_object_keys(v_old_json) AS key
                        UNION
                        SELECT jsonb_object_keys(v_new_json) AS key
                    ) keys
                    ORDER BY key
                LOOP
                    v_old_val := v_old_json ->> v_key;
                    v_new_val := v_new_json ->> v_key;

                    IF COALESCE(v_old_val, '') IS DISTINCT FROM COALESCE(v_new_val, '') THEN
                        INSERT INTO audit_log (table_name, record_oid, action, field_name, old_value, new_value, changed_by)
                        VALUES (TG_TABLE_NAME, v_oid, 'UPDATE', v_key, v_old_val, v_new_val, v_user);
                        v_has_change := TRUE;
                    END IF;
                END LOOP;

                CONTINUE;
            END IF;

            EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_col, v_col)
                INTO v_old_val, v_new_val
                USING OLD, NEW;

            IF COALESCE(v_old_val, '') IS DISTINCT FROM COALESCE(v_new_val, '') THEN
                INSERT INTO audit_log (table_name, record_oid, action, field_name, old_value, new_value, changed_by)
                VALUES (TG_TABLE_NAME, v_oid, 'UPDATE', v_col, v_old_val, v_new_val, v_user);
                v_has_change := TRUE;
            END IF;
        END LOOP;

        IF NOT v_has_change THEN
            INSERT INTO audit_log (table_name, record_oid, action, field_name, changed_by)
            VALUES (TG_TABLE_NAME, v_oid, 'UPDATE', NULL, v_user);
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$function$;

WITH source_rows AS (
    SELECT id, table_name, record_oid, action, old_value, new_value, changed_by, changed_at,
           COALESCE(CASE WHEN old_value IS NULL OR BTRIM(old_value) = '' THEN '{}'::jsonb ELSE old_value::jsonb END, '{}'::jsonb) AS old_json,
           COALESCE(CASE WHEN new_value IS NULL OR BTRIM(new_value) = '' THEN '{}'::jsonb ELSE new_value::jsonb END, '{}'::jsonb) AS new_json
    FROM audit_log
    WHERE field_name = 'custom_fields'
      AND action = 'UPDATE'
), expanded AS (
    SELECT
        s.id AS source_id,
        s.table_name,
        s.record_oid,
        s.action,
        keys.key AS field_name,
        s.old_json ->> keys.key AS old_value,
        s.new_json ->> keys.key AS new_value,
        s.changed_by,
        s.changed_at
    FROM source_rows s
    CROSS JOIN LATERAL (
        SELECT key
        FROM (
            SELECT jsonb_object_keys(s.old_json) AS key
            UNION
            SELECT jsonb_object_keys(s.new_json) AS key
        ) union_keys
    ) keys
    WHERE COALESCE(s.old_json ->> keys.key, '') IS DISTINCT FROM COALESCE(s.new_json ->> keys.key, '')
), inserted AS (
    INSERT INTO audit_log (oid, table_name, record_oid, action, field_name, old_value, new_value, changed_by, changed_at, created_at, created_by, updated_at, updated_by)
    SELECT
        gen_random_uuid(),
        table_name,
        record_oid,
        action,
        field_name,
        old_value,
        new_value,
        changed_by,
        changed_at,
        changed_at,
        changed_by,
        changed_at,
        changed_by
    FROM expanded
    RETURNING 1
)
DELETE FROM audit_log
WHERE id IN (
    SELECT id
    FROM audit_log
    WHERE field_name = 'custom_fields'
      AND action = 'UPDATE'
);
