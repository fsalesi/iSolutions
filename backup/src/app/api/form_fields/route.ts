import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createCrudRoutes } from "@/lib/crud-route";

let ensureIsKeyColumnPromise: Promise<void> | null = null;

async function ensureIsKeyColumn(): Promise<void> {
  if (!ensureIsKeyColumnPromise) {
    ensureIsKeyColumnPromise = (async () => {
      const existsRes = await db.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'form_fields'
            AND column_name = 'is_key'`
      );

      if (existsRes.rows.length === 0) {
        await db.query(`ALTER TABLE form_fields ADD COLUMN is_key boolean NOT NULL DEFAULT false`);
        // Backfill legacy behavior once: previously unique fields acted as key fields.
        await db.query(`UPDATE form_fields SET is_key = true WHERE is_unique = true`);
      }
    })();
  }

  await ensureIsKeyColumnPromise;
}

const routes = createCrudRoutes({
  table: "form_fields",
  columns: ["form_key", "table_name", "field_name", "data_type", "max_length", "precision", "scale", "is_nullable", "default_value", "is_indexed", "is_unique", "is_key", "is_copyable", "case_sensitive", "sort_order", "to_be_deleted", "is_generated", "is_dirty"],
  defaultSort: "sort_order",
  searchColumns: ["field_name"],
  requiredFields: ["form_key", "table_name", "field_name"],
  uniqueErrorMsg: (body) => `Field "${body.field_name}" already exists in table "${body.table_name}"`,
});

export async function GET(req: NextRequest) {
  await ensureIsKeyColumn();
  return routes.GET(req);
}

export async function POST(req: NextRequest) {
  await ensureIsKeyColumn();
  return routes.POST(req);
}

export async function PUT(req: NextRequest) {
  await ensureIsKeyColumn();
  return routes.PUT(req);
}

export async function DELETE(req: NextRequest) {
  await ensureIsKeyColumn();
  return routes.DELETE(req);
}
