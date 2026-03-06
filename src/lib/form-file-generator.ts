/**
 * form-file-generator.ts — Creates the 4 per-form files for the three-tier
 * inheritance chain. Called by Entity Designer's Generate button.
 *
 * Files generated (never overwritten if they already exist):
 *   1. src/app/api/forms/<formKey>/route.ts  — Product API route
 *   2. src/components/forms/<formKey>/Page.tsx — Product page component
 *   3. customer/forms/<formKey>/route.ts      — Customer API route shim
 *   4. customer/forms/<formKey>/Page.tsx       — Customer page shim
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/* ── Helpers ── */

/** snake_case → PascalCase: "po_req" → "PoReq", "suppliers" → "Suppliers" */
function toPascal(key: string): string {
  return key
    .split(/[_\-]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/* ── Templates ── */

function productRouteTemplate(
  formKey: string,
  className: string,
  restrictedFields: string[] = [],
  passwordFields: string[] = [],
  imageFields: string[] = [],
): string {
  const restrictedLine = restrictedFields.length > 0
    ? `  protected restrictedFields = ${JSON.stringify(restrictedFields)};
`
    : "";
  const passwordLine = passwordFields.length > 0
    ? `  protected passwordFields = ${JSON.stringify(passwordFields)};
`
    : "";
  const transformRowBlock = imageFields.length > 0
    ? `
  async transformRow(row: Record<string, any>, meta: TableMeta): Promise<Record<string, any>> {
    const out = { ...row };
${imageFields.map(f => `    if (out["${f}"] != null) out["${f}"] = \`/api/forms/${formKey}/image?field=${f}&oid=\${out.oid}\`;`).join("\n")}
    return out;
  }
`
    : "";
  return `/**
 * ${className} — Product API route (ISS layer).
 * Extends CrudRoute base class. ISS developers add business logic here.
 *
 * Hook methods available to override:
 *   validate(data, meta, userId)          — throw to reject before save
 *   beforeSave(data, meta, userId, isNew) — mutate data before insert/update
 *   afterSave(saved, meta, userId, isNew) — side effects after save
 *   beforeDelete(oid, meta, userId)       — throw to prevent deletion
 *   afterDelete(oid, meta, userId)        — cleanup after delete
 *   transformRow(row, meta)               — modify row before returning to client
 *   transformList(rows, meta)             — modify list before returning to client
 */
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";
import type { TableMeta } from "@/lib/CrudRoute";

export class ${className}Route extends CrudRoute {
${restrictedLine}${passwordLine}  constructor() {
    super("${formKey}");
  }${transformRowBlock}

  // ISS: Add hooks here. Examples:
  //
  // async validate(data: Record<string, any>, meta: TableMeta, userId: string) {
  //   if (!data.vendor_code) throw new Error("Vendor code is required");
  // }
  //
  // async beforeSave(data: Record<string, any>, meta: TableMeta, userId: string, isNew: boolean) {
  //   data.vendor_code = data.vendor_code?.toUpperCase();
  //   return data;
  // }
}

// --- Customer override resolution ---
// If a customer route exists, use it instead of the product route.
let RouteClass: { new(): CrudRoute } = ${className}Route;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cust = require("@customer/forms/${formKey}/route");
  if (cust?.default) RouteClass = cust.default;
} catch {
  // No customer override — use product route
}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
`;
}

function productPageTemplate(formKey: string, className: string): string {
  return `/**
 * ${className}Page — Product page component (ISS layer).
 * Wraps the engine FormPage with this form's key and API path.
 * ISS developers can add custom tabs, toolbar buttons, or field renderers here.
 */
import { FormPage } from "@/components/pages/FormPage";

interface Props {
  activeNav: string;
  onNavigate: (key: string, oid?: string) => void;
}

export default function ${className}Page({ activeNav, onNavigate }: Props) {
  return (
    <FormPage
      formKey="${formKey}"
      apiPath="/api/forms/${formKey}"
      activeNav={activeNav}
      onNavigate={onNavigate}
    />
  );
}
`;
}

function customerRouteTemplate(formKey: string, className: string): string {
  return `/**
 * Customer${className}Route — Customer API route override.
 * Extends the ISS product route. Customer developers add their logic here.
 * This file is NEVER overwritten by re-generate.
 *
 * Hook methods available to override (call super to chain):
 *   validate(data, meta, userId)          — throw to reject before save
 *   beforeSave(data, meta, userId, isNew) — mutate data before insert/update
 *   afterSave(saved, meta, userId, isNew) — side effects after save
 *   beforeDelete(oid, meta, userId)       — throw to prevent deletion
 *   afterDelete(oid, meta, userId)        — cleanup after delete
 *   transformRow(row, meta)               — modify row before returning to client
 *   transformList(rows, meta)             — modify list before returning to client
 */
import { ${className}Route } from "@/app/api/forms/${formKey}/route";
// import type { TableMeta } from "@/lib/CrudRoute";

export default class Customer${className}Route extends ${className}Route {
  // Customer: Add overrides here. Examples:
  //
  // async validate(data: Record<string, any>, meta: TableMeta, userId: string) {
  //   await super.validate(data, meta, userId); // chain to ISS logic first
  //   if (data.amount > 50000) throw new Error("Requires executive approval");
  // }
}
`;
}

function customerPageTemplate(formKey: string, className: string): string {
  return `/**
 * Customer ${className} page override.
 * Re-exports the ISS product page by default.
 * Customer developers can replace this with a fully custom component.
 * This file is NEVER overwritten by re-generate.
 */
export { default } from "@/components/forms/${formKey}/Page";
`;
}

/* ── Generator ── */

export interface GenerateFilesResult {
  created: string[];
  skipped: string[];
}

/**
 * Generate the 4 per-form files for the three-tier inheritance chain.
 * Files are never overwritten — if a file already exists it's skipped.
 *
 * @param formKey  - Form key (snake_case), e.g. "po_req" or "suppliers"
 * @param formName - Human-readable name (for comments only), e.g. "Purchase Requisition"
 * @returns Lists of created and skipped file paths
 */
export interface SpecialFields {
  restrictedFields: string[];
  passwordFields: string[];
  imageFields: string[];
}

export function generateFormFiles(formKey: string, _formName: string, special: SpecialFields = { restrictedFields: [], passwordFields: [], imageFields: [] }): GenerateFilesResult {
  const className = toPascal(formKey);
  const projectRoot = process.cwd();
  const created: string[] = [];
  const skipped: string[] = [];

  const files: { path: string; content: string }[] = [
    {
      path: join("src", "app", "api", "forms", formKey, "route.ts"),
      content: productRouteTemplate(formKey, className, special.restrictedFields, special.passwordFields, special.imageFields),
    },
    {
      path: join("src", "components", "forms", formKey, "Page.tsx"),
      content: productPageTemplate(formKey, className),
    },
    {
      path: join("customer", "forms", formKey, "route.ts"),
      content: customerRouteTemplate(formKey, className),
    },
    {
      path: join("customer", "forms", formKey, "Page.tsx"),
      content: customerPageTemplate(formKey, className),
    },
  ];

  for (const file of files) {
    const fullPath = join(projectRoot, file.path);
    if (existsSync(fullPath)) {
      skipped.push(file.path);
    } else {
      mkdirSync(join(fullPath, ".."), { recursive: true });
      writeFileSync(fullPath, file.content, "utf-8");
      created.push(file.path);
    }
  }

  return { created, skipped };
}
