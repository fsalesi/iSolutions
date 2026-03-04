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
      await db.query(
        `UPDATE forms SET is_generated = true, last_generated_at = now(), needs_generate = false WHERE form_key = $1`,
        [form_key]
      );

      // Auto-generate default layout rows for any new fields
      const layoutResult = await generateDefaultLayout(form_key);
      layoutInserted = layoutResult.inserted;

      // Generate per-form files (product + customer route & page)
      const fileResult = generateFormFiles(form_key, form.form_name);
      filesCreated = fileResult.created;
      filesSkipped = fileResult.skipped;

      // Rebuild the page registry (scans all generated Page.tsx files)
      regenerateFormPageRegistry();
    }

    return NextResponse.json({
      ops,
      ...result,
      is_generated: result.errors.length === 0,
      layoutInserted,
      filesCreated,
      filesSkipped,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
