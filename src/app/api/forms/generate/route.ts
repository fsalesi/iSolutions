import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSchema, executeDdl } from "@/lib/schema-generator";
import { generateDefaultLayout } from "@/lib/layout-generator";
import { generateFormFiles } from "@/lib/form-file-generator";
import { regenerateFormPageRegistry } from "@/lib/form-page-registry-generator";

export async function POST(req: NextRequest) {
  try {
    const { form_key, preview } = await req.json();
    if (!form_key) {
      return NextResponse.json({ error: "form_key is required" }, { status: 400 });
    }

    // Load form to get has_approvals flag + form_name
    const formRes = await db.query(
      `SELECT form_key, form_name, has_approvals FROM forms WHERE form_key = $1`,
      [form_key]
    );
    if (formRes.rows.length === 0) {
      return NextResponse.json({ error: `Form "${form_key}" not found` }, { status: 404 });
    }
    const form = formRes.rows[0];

    // Generate DDL operations
    const ops = await generateSchema(form_key, form.has_approvals);

    // Preview mode — return ops without executing
    if (preview) {
      return NextResponse.json({ ops });
    }

    // Execute DDL
    const result = await executeDdl(ops);

    // If DDL succeeded, generate layout + files + registry
    let layoutInserted = 0;
    let filesCreated: string[] = [];
    let filesSkipped: string[] = [];

    if (result.errors.length === 0) {
      // Mark tables and fields FIRST (triggers updated_at), then stamp the form last
      await db.query(
        `UPDATE form_tables SET is_generated = true WHERE form_key = $1 AND to_be_deleted = false`,
        [form_key]
      );
      await db.query(
        `UPDATE form_fields SET is_generated = true, is_dirty = false WHERE form_key = $1 AND to_be_deleted = false`,
        [form_key]
      );
      // last_generated_at must be set AFTER fields so it's >= all field updated_at values
      await db.query(
        `UPDATE forms SET last_generated_at = now(), needs_generate = false WHERE form_key = $1`,
        [form_key]
      );

      // Auto-generate default layout rows for any new fields
      const layoutResult = await generateDefaultLayout(form_key);
      layoutInserted = layoutResult.inserted;

      // Query special fields (password, image, restricted) at generation time — baked into generated files
      const specialRes = await db.query(
        `SELECT field_name, data_type FROM form_fields WHERE form_key = $1 AND to_be_deleted = false`,
        [form_key]
      );
      const restrictedFields: string[] = [];
      const passwordFields: string[] = [];
      const imageFields: string[] = [];
      for (const row of specialRes.rows) {
        if (row.data_type === "password") {
          passwordFields.push(row.field_name);
        } else if (row.data_type === "image") {
          imageFields.push(row.field_name);
        }
        // future: if (row.is_restricted && row.data_type !== "password") restrictedFields.push(row.field_name);
      }

      // Generate per-form files (product + customer route & page)
      const fileResult = generateFormFiles(form_key, form.form_name, { restrictedFields, passwordFields, imageFields });
      filesCreated = fileResult.created;
      filesSkipped = fileResult.skipped;

      // Rebuild the page registry (scans all generated Page.tsx files)
      regenerateFormPageRegistry();
    }

    return NextResponse.json({
      ops,
      ...result,
      layoutInserted,
      filesCreated,
      filesSkipped,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
