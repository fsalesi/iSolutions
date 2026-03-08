import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { form_key, table_name } = await req.json();
    if (!form_key || !table_name) {
      return NextResponse.json({ error: "form_key and table_name required" }, { status: 400 });
    }

    // Check the table actually exists in the DB schema
    const tableExistsRes = await db.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table_name]
    );
    const tableExistsInDb = tableExistsRes.rows.length > 0;

    // 1. Hard DELETE fields that were never generated (is_generated = false)
    const deletedRes = await db.query(
      `DELETE FROM form_fields WHERE form_key = $1 AND table_name = $2 AND is_generated = false
       RETURNING field_name`,
      [form_key, table_name]
    );
    const deletedFields = deletedRes.rows.map((r: any) => r.field_name);

    // 2. Restore fields marked for deletion (to_be_deleted = true)
    const restoredRes = await db.query(
      `UPDATE form_fields SET to_be_deleted = false WHERE form_key = $1 AND table_name = $2
       AND to_be_deleted = true AND is_generated = true
       RETURNING field_name`,
      [form_key, table_name]
    );
    const restoredFields = restoredRes.rows.map((r: any) => r.field_name);

    // 3. For modified fields (is_dirty = true, is_generated = true), sync properties back from DB schema
    let syncedFields: string[] = [];
    if (tableExistsInDb) {
      const schemaRes = await db.query(
        `SELECT
           c.column_name,
           c.udt_name AS data_type,
           c.data_type AS pg_data_type,
           c.character_maximum_length,
           c.numeric_precision,
           c.numeric_scale,
           c.is_nullable,
           c.column_default
         FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.table_name = $1`,
        [table_name]
      );

      // Also read CHECK length constraints (citext fields use CHECK instead of column length)
      const checkRes = await db.query(
        `SELECT
           a.attname AS column_name,
           -- Extract the number from CHECK (length(col) <= N)
           (regexp_match(pg_get_constraintdef(c.oid), 'length\(.*?\)\s*<=\s*(\d+)'))[1]::int AS max_length
         FROM pg_constraint c
         JOIN pg_class r ON c.conrelid = r.oid
         JOIN pg_namespace n ON r.relnamespace = n.oid
         JOIN unnest(c.conkey) AS k(attnum) ON true
         JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum = k.attnum
         WHERE n.nspname = 'public' AND r.relname = $1 AND c.contype = 'c'
           AND pg_get_constraintdef(c.oid) LIKE '%length%<=%'`,
        [table_name]
      );
      const checkLengths = new Map(checkRes.rows.map((r: any) => [r.column_name, r.max_length]));

      // Read indexes to restore is_indexed / is_unique
      const idxRes = await db.query(
        `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
        [table_name]
      );
      const uniqueIndexCols = new Set<string>();
      const indexedCols = new Set<string>();
      for (const idx of idxRes.rows) {
        const uMatch = (idx.indexname as string).match(/^uidx_[^_]+_(.+)$/);
        const iMatch = (idx.indexname as string).match(/^idx_[^_]+_(.+)$/);
        if (uMatch) uniqueIndexCols.add(uMatch[1]);
        else if (iMatch) indexedCols.add(iMatch[1]);
      }

      const schemaMap = new Map(schemaRes.rows.map((r: any) => {
        // Normalize udt_name → form_fields data_type values
        const udt = (r.data_type || '').toLowerCase();  // COALESCE already applied in SELECT
        let dataType = udt;
        if (['citext', 'varchar', 'bpchar', 'character varying'].some(t => udt.includes(t))) dataType = 'text';
        else if (udt === 'bool') dataType = 'boolean';
        else if (['int4','int8','int2','bigint','smallint'].includes(udt)) dataType = 'integer';
        else if (udt === 'timestamp with time zone') dataType = 'timestamptz';
        // date, uuid, jsonb, numeric, text stay as-is

        // case_sensitive: citext = false, everything else = true
        const caseSensitive = !udt.includes('citext');

        // max_length: varchar uses column def, citext uses CHECK constraint
        const maxLength = (r.character_maximum_length ?? checkLengths.get(r.column_name)) ?? null;

        // default_value: strip PG type casts like ''::citext → '', 0::integer → 0
        let defaultValue: string = r.column_default ?? '';
        // 'val'::type  →  val
        defaultValue = defaultValue.replace(/^'([^']*)'::[-\w\s]+$/, '$1');
        // 0::integer  →  0
        defaultValue = defaultValue.replace(/^(\d+(?:\.\d+)?)::[\w\s]+$/, '$1');
        // '{}'::jsonb  →  {}
        defaultValue = defaultValue.replace(/^'\{\}'::[\w\s]+$/, '{}');

        return [r.column_name, {
          data_type: dataType,
          max_length: maxLength,
          precision: r.numeric_precision ?? null,
          scale: r.numeric_scale ?? null,
          is_nullable: r.is_nullable === 'YES',
          default_value: defaultValue,
          case_sensitive: caseSensitive,
          is_indexed: uniqueIndexCols.has(r.column_name) || indexedCols.has(r.column_name),
          is_unique: uniqueIndexCols.has(r.column_name),
        }];
      }));

      // Disable dirty trigger during sync so reset doesn't re-mark fields as dirty
      await db.query(`ALTER TABLE form_fields DISABLE TRIGGER trg_form_fields_dirty`);
      try {
      // Sync ALL generated fields back to actual schema (not just dirty ones)
      const dirtyRes = await db.query(
        `SELECT oid, field_name FROM form_fields
         WHERE form_key = $1 AND table_name = $2 AND is_generated = true AND to_be_deleted = false`,
        [form_key, table_name]
      );

      for (const field of dirtyRes.rows) {
        const schema = schemaMap.get(field.field_name);
        if (!schema) continue; // Field doesn't exist in DB - leave it

        // Bypass the is_dirty trigger by setting is_dirty = false in the same UPDATE
        await db.query(
          `UPDATE form_fields SET
             data_type = $1,
             max_length = $2,
             precision = $3,
             scale = $4,
             is_nullable = $5,
             default_value = $6,
             case_sensitive = $7,
             is_indexed = $8,
             is_unique = $9,
             is_dirty = false
           WHERE oid = $10`,
          [
            schema.data_type,
            schema.max_length || null,
            schema.precision || null,
            schema.scale || null,
            schema.is_nullable,
            schema.default_value,
            schema.case_sensitive,
            schema.is_indexed,
            schema.is_unique,
            field.oid,
          ]
        );
        syncedFields.push(field.field_name);
      }

      } finally {
        await db.query(`ALTER TABLE form_fields ENABLE TRIGGER trg_form_fields_dirty`);
      }
    } // end if (tableExistsInDb)
    // 4. Reset forms.needs_generate if no other dirty tables remain
    const remainingDirtyRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM form_fields
       WHERE form_key = $1 AND (is_generated = false OR is_dirty = true OR to_be_deleted = true)`,
      [form_key]
    );
    const remainingDirty = parseInt(remainingDirtyRes.rows[0].cnt, 10);
    if (remainingDirty === 0) {
      await db.query(`UPDATE forms SET needs_generate = false WHERE form_key = $1`, [form_key]);
    }

    return NextResponse.json({
      ok: true,
      deleted: deletedFields,
      restored: restoredFields,
      synced: syncedFields,
      still_dirty: remainingDirty > 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
