"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { Section, TabBar, type TabDef, Input, Select, Field, Badge } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import { NumberInput } from "@/components/ui/NumberInput";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { Icon } from "@/components/icons/Icon";

type Row = { oid: string; [key: string]: any };
type FormTable = { oid: string; form_key: string; table_name: string; is_header: boolean; parent_table: string; tab_label: string; has_attachments: boolean; sort_order: number };
type FormField = { oid: string; form_key: string; table_name: string; field_name: string; data_type: string; max_length: number | null; precision: number | null; scale: number | null; is_nullable: boolean; default_value: string; is_indexed: boolean; is_unique: boolean; is_copyable: boolean; case_sensitive: boolean; sort_order: number; created_at: string; updated_at: string };

const DATA_TYPES = [
  { value: "text", label: "Text" },
  { value: "integer", label: "Integer" },
  { value: "numeric", label: "Numeric" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "timestamptz", label: "Datetime" },
  { value: "uuid", label: "UUID" },
  { value: "jsonb", label: "JSONB" },
];

const STANDARD_FIELDS = ["oid", "domain", "created_at", "created_by", "updated_at", "updated_by", "custom_fields"];
const HEADER_ONLY_FIELDS = ["copied_from"];

const PG_IDENT_RE = /^[a-z][a-z0-9_]*$/;

/* ── helpers ──────────────────────────────────────────────── */
function buildFilters(field: string, value: string) {
  return JSON.stringify({
    type: "group", logic: "and",
    children: [{ type: "condition", field, operator: "eq", value }],
  });
}

function buildFilters2(f1: string, v1: string, f2: string, v2: string) {
  return JSON.stringify({
    type: "group", logic: "and",
    children: [
      { type: "condition", field: f1, operator: "eq", value: v1 },
      { type: "condition", field: f2, operator: "eq", value: v2 },
    ],
  });
}

/* ── General Tab ─────────────────────────────────────────── */
type DdlOp = { type: string; table: string; sql: string; description: string };

function GeneralTab({ row, isNew, onChange, colTypes, colScales, requiredFields, isDirty, setIsDirty }: {
  row: Row; isNew: boolean; onChange: (f: keyof Row, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>;
  requiredFields?: string[]; isDirty: boolean; setIsDirty: (v: boolean) => void;
}) {
  const t = useT();
  const { field } = useFieldHelper({ row, onChange, table: "forms", colTypes: colTypes as any, colScales, requiredFields });

  const [genState, setGenState] = useState<"idle" | "previewing" | "executing" | "done">("idle");
  const [ops, setOps] = useState<DdlOp[]>([]);
  const [result, setResult] = useState<{ executed: number; warnings: number; errors: string[]; filesCreated: string[]; filesSkipped: string[] } | null>(null);
  const [genError, setGenError] = useState("");
  const handlePreview = async () => {
    setGenState("previewing");
    setGenError("");
    setOps([]);
    setResult(null);
    try {
      const res = await fetch("/api/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_key: row.form_key, preview: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      const newOps = data.ops || [];
      setOps(newOps);
      if (newOps.length === 0) {
        // No DDL changes, but still execute to generate files + layout
        const execRes = await fetch("/api/forms/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form_key: row.form_key, preview: false }),
        });
        const execData = await execRes.json();
        setResult({ executed: 0, warnings: 0, errors: execData.errors || [], filesCreated: execData.filesCreated || [], filesSkipped: execData.filesSkipped || [] });
        setGenState("done");
        if (execData.is_generated) {
          onChange("is_generated" as keyof Row, true);
          onChange("last_generated_at" as keyof Row, new Date().toISOString());
          setIsDirty(false);
        }
      }
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : String(err));
      setGenState("idle");
    }
  };

  const handleExecute = async () => {
    setGenState("executing");
    setGenError("");
    try {
      const res = await fetch("/api/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_key: row.form_key, preview: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      setResult({ executed: data.executed, warnings: data.warnings, errors: data.errors, filesCreated: data.filesCreated || [], filesSkipped: data.filesSkipped || [] });
      setOps(data.ops || []);
      setGenState("done");
      if (data.is_generated) {
        onChange("is_generated" as keyof Row, true);
        onChange("last_generated_at" as keyof Row, new Date().toISOString());
        setIsDirty(false);
      }
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : String(err));
      setGenState("done");
    }
  };

  const handleCancel = () => {
    setGenState("idle");
    setOps([]);
    setResult(null);
    setGenError("");
  };

  const opColor = (type: string) => {
    if (type === "warning") return "var(--warning-text)";
    if (type === "create_table") return "var(--success-text)";
    if (type === "drop_index") return "var(--danger-text)";
    return "var(--text-primary)";
  };

  return (
    <div className="space-y-6">
      <Section title={t("forms.section_general", "General")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("form_key", { readOnly: !isNew, autoFocus: isNew, placeholder: "e.g. suppliers" })}
          {field("form_name", { placeholder: "e.g. Supplier Maintenance" })}
          {field("menu_category", { placeholder: "e.g. Procurement" })}
        </div>
      </Section>
      <Section title={t("forms.section_options", "Options")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("has_approvals", { label: "Use Approval Workflow", colorOn: "var(--success-text)", colorOff: "var(--text-muted)" })}
        </div>
      </Section>
      <Section title={t("forms.section_description", "Description")}>
        {field("description", { placeholder: "Optional description of this form" })}
      </Section>

      {/* Schema Generation */}
      {!isNew && row.form_key && (
        <Section title="Schema Generation">
          {genState === "idle" && (
            <div className="flex items-center gap-4">
              <button
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-colors"
                style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
                onClick={handlePreview}
              >
                <Icon name="zap" size={14} />
                {row.is_generated ? "Re-generate Schema" : "Generate Schema"}
              </button>
              {row.is_generated && !isDirty && <Badge variant="success">Generated</Badge>}
              {row.is_generated && isDirty && <Badge variant="warning">Schema Out of Sync</Badge>}
            </div>
          )}

          {genState === "previewing" && ops.length === 0 && !genError && (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Analyzing schema...</div>
          )}

          {genError && (
            <div className="text-sm" style={{ color: "var(--danger-text)" }}>{genError}</div>
          )}

          {genState === "previewing" && ops.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {ops.length} operation{ops.length !== 1 ? "s" : ""} to execute:
              </div>
              <div className="rounded-lg overflow-hidden max-h-96 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
                {ops.map((op, i) => (
                  <div key={i} className="px-3 py-2 text-xs font-mono" style={{ borderBottom: "1px solid var(--border)", background: i % 2 ? "var(--bg-secondary)" : "var(--bg-primary)" }}>
                    <div className="font-sans text-sm font-medium mb-1" style={{ color: opColor(op.type) }}>{op.description}</div>
                    <div style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>{op.sql}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-colors"
                  style={{ background: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--success-border)" }}
                  onClick={handleExecute}
                >
                  <Icon name="check" size={14} /> Execute
                </button>
                <button
                  className="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {genState === "executing" && (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Executing DDL...</div>
          )}

          {genState === "done" && result && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {result.errors.length === 0 && result.executed === 0 ? (
                  <Badge variant="success">Schema is up to date</Badge>
                ) : result.errors.length === 0 ? (
                  <Badge variant="success">{result.executed} operations executed successfully</Badge>
                ) : (
                  <Badge variant="danger">{result.errors.length} error{result.errors.length !== 1 ? "s" : ""}</Badge>
                )}
                {result.warnings > 0 && (
                  <Badge variant="warning">{result.warnings} warning{result.warnings !== 1 ? "s" : ""}</Badge>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-xs" style={{ color: "var(--danger-text)" }}>{e}</div>
                  ))}
                </div>
              )}
              {ops.filter(o => o.type === "warning").length > 0 && (
                <div className="space-y-1">
                  {ops.filter(o => o.type === "warning").map((o, i) => (
                    <div key={i} className="text-xs" style={{ color: "var(--warning-text)" }}>{o.description}</div>
                  ))}
                </div>
              )}
              {result.filesCreated.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium" style={{ color: "var(--success-text)" }}>Files created:</div>
                  {result.filesCreated.map((f, i) => (
                    <div key={i} className="text-xs" style={{ color: "var(--text-muted)", paddingLeft: 12 }}>{f}</div>
                  ))}
                </div>
              )}
              {result.filesSkipped.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Files already exist (skipped):</div>
                  {result.filesSkipped.map((f, i) => (
                    <div key={i} className="text-xs" style={{ color: "var(--text-muted)", paddingLeft: 12 }}>{f}</div>
                  ))}
                </div>
              )}
              <button
                className="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                onClick={handleCancel}
              >
                OK
              </button>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

/* ── Tables Tab ──────────────────────────────────────────── */
function TablesTab({ row }: { row: Row }) {
  const t = useT();
  const formKey = row.form_key;
  const isNew = !row.oid;

  const [tables, setTables] = useState<FormTable[]>([]);
  const [editing, setEditing] = useState<FormTable | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<FormTable>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchTables = useCallback(() => {
    if (!formKey) return;
    const filters = buildFilters("form_key", formKey);
    fetch(`/api/form_tables?filters=${encodeURIComponent(filters)}&limit=100&sort=sort_order`)
      .then(r => r.json())
      .then(data => setTables(data.rows || []))
      .catch(() => setTables([]));
  }, [formKey]);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  if (isNew) return <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>Save the form first to add tables.</div>;

  const parentOptions = [{ value: "", label: "(none — header)" }, ...tables.map(t => ({ value: t.table_name, label: t.table_name }))];

  const validate = (d: Partial<FormTable>, existingOid?: string) => {
    if (!d.table_name) return "Table name is required";
    if (!PG_IDENT_RE.test(d.table_name)) return "Table name must be lowercase letters, digits, underscores, starting with a letter";
    if (tables.some(t => t.table_name === d.table_name && t.oid !== existingOid)) return `Table "${d.table_name}" already exists`;
    const isHeader = d.is_header ?? !d.parent_table;
    if (isHeader && tables.some(t => t.is_header && t.oid !== existingOid)) return "Only one header table allowed per form";
    if (!isHeader && !d.parent_table) return "Child tables must have a parent table";
    if (d.parent_table === d.table_name) return "A table cannot be its own parent";
    return "";
  };

  const saveDraft = async (isEdit: boolean) => {
    const existing = isEdit ? editing : undefined;
    const err = validate(draft, existing?.oid);
    if (err) { setError(err); return; }
    setError("");
    setBusy(true);

    const body = {
      form_key: formKey,
      table_name: draft.table_name || "",
      is_header: draft.is_header ?? (!draft.parent_table),
      parent_table: draft.is_header ? "" : (draft.parent_table || ""),
      tab_label: draft.tab_label || draft.table_name || "",
      has_attachments: draft.has_attachments ?? false,
      sort_order: draft.sort_order ?? 0,
    };

    try {
      if (isEdit && existing) {
        await fetch("/api/form_tables", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oid: existing.oid, ...body }),
        });
      } else {
        const res = await fetch("/api/form_tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        // Auto-create oid_<parent_table> FK field for child tables
        if (res.ok && body.parent_table) {
          await fetch("/api/form_fields", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              form_key: formKey,
              table_name: body.table_name,
              field_name: `oid_${body.parent_table}`,
              data_type: "uuid",
              is_nullable: false,
              is_indexed: true,
              is_copyable: false,
              sort_order: 0,
            }),
          });
        }
      }
      setAdding(false);
      setEditing(null);
      setDraft({});
      fetchTables();
    } catch {
      setError("Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const deleteTable = async (tbl: FormTable) => {
    if (!confirm(`Delete table "${tbl.table_name}" and all its fields? This cannot be undone.`)) return;
    await fetch("/api/form_tables", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oid: tbl.oid }),
    });
    fetchTables();
  };

  const startAdd = () => { setAdding(true); setEditing(null); setDraft({ sort_order: (tables.length + 1) * 10 }); setError(""); };
  const startEdit = (tbl: FormTable) => { setEditing(tbl); setAdding(false); setDraft({ ...tbl }); setError(""); };
  const cancel = () => { setAdding(false); setEditing(null); setDraft({}); setError(""); };

  const isFormMode = adding || editing;

  return (
    <div className="space-y-4">
      {/* Table list */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Table Name</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Type</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Parent</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Tab Label</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Attach</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Order</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {tables.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>No tables yet. Click "Add Table" to start designing.</td></tr>
            )}
            {tables.map(tbl => (
              <tr
                key={tbl.oid}
                className="transition-colors cursor-pointer"
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
                onClick={() => startEdit(tbl)}
              >
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-primary)" }}>{tbl.table_name}</td>
                <td className="px-3 py-2">
                  <Badge variant={tbl.is_header ? "info" : "neutral"}>{tbl.is_header ? "Header" : "Child"}</Badge>
                </td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{tbl.parent_table || "—"}</td>
                <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>{tbl.tab_label}</td>
                <td className="px-3 py-2">{tbl.has_attachments ? <Badge variant="info">Yes</Badge> : "—"}</td>
                <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{tbl.sort_order}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="p-1 rounded transition-colors"
                    style={{ color: "var(--danger-text)" }}
                    onClick={e => { e.stopPropagation(); deleteTable(tbl); }}
                    title="Delete table"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit form */}
      {isFormMode ? (
        <div className="rounded-lg p-4 space-y-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {editing ? `Edit: ${editing.table_name}` : "Add Table"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Table Name" required>
              <Input
                value={draft.table_name || ""}
                onChange={v => setDraft(d => ({ ...d, table_name: v }))}
                placeholder="e.g. supplier_addresses"
                readOnly={!!editing}
              />
            </Field>
            <Field label="Parent Table">
              <Select
                value={draft.parent_table || ""}
                onChange={v => setDraft(d => ({ ...d, parent_table: v, is_header: !v }))}
                options={parentOptions.filter(o => o.value !== draft.table_name)}
              />
            </Field>
            <Field label="Tab Label">
              <Input
                value={draft.tab_label || ""}
                onChange={v => setDraft(d => ({ ...d, tab_label: v }))}
                placeholder="Display name for tab"
              />
            </Field>
            <Field label="Sort Order">
              <NumberInput
                value={draft.sort_order ?? 0}
                onChange={v => setDraft(d => ({ ...d, sort_order: v }))}
                scale={0}
              />
            </Field>
            <Field label="Attachments">
              <Toggle value={draft.has_attachments ?? false} onChange={v => setDraft(d => ({ ...d, has_attachments: v }))} />
            </Field>
          </div>
          {error && <div className="text-sm" style={{ color: "var(--danger-text)" }}>{error}</div>}
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
              style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
              onClick={() => saveDraft(!!editing)}
              disabled={busy}
            >
              {editing ? "Update" : "Add"}
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
          onClick={startAdd}
        >
          <Icon name="plus" size={14} /> Add Table
        </button>
      )}
    </div>
  );
}

/* ── Fields Tab ──────────────────────────────────────────── */
function FieldsTab({ row }: { row: Row }) {
  const t = useT();
  const formKey = row.form_key;
  const isNew = !row.oid;

  const [tables, setTables] = useState<FormTable[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [editing, setEditing] = useState<FormField | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<FormField>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Fetch tables for selector
  useEffect(() => {
    if (!formKey) return;
    const filters = buildFilters("form_key", formKey);
    fetch(`/api/form_tables?filters=${encodeURIComponent(filters)}&limit=100&sort=sort_order`)
      .then(r => r.json())
      .then(data => {
        const rows = data.rows || [];
        setTables(rows);
        if (rows.length > 0 && !selectedTable) {
          const hdr = rows.find((r: FormTable) => r.is_header);
          setSelectedTable(hdr ? hdr.table_name : rows[0].table_name);
        }
      })
      .catch(() => setTables([]));
  }, [formKey]);

  // Fetch fields when table selected
  const fetchFields = useCallback(() => {
    if (!formKey || !selectedTable) { setFields([]); return; }
    const filters = buildFilters2("form_key", formKey, "table_name", selectedTable);
    fetch(`/api/form_fields?filters=${encodeURIComponent(filters)}&limit=500&sort=sort_order`)
      .then(r => r.json())
      .then(data => setFields(data.rows || []))
      .catch(() => setFields([]));
  }, [formKey, selectedTable]);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  if (isNew) return <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>Save the form first to add fields.</div>;
  if (tables.length === 0) return <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>Add tables first (Tables tab).</div>;

  const currentTable = tables.find(t => t.table_name === selectedTable);
  const isHeader = currentTable?.is_header ?? false;
  const standardFields = [...STANDARD_FIELDS, ...(isHeader ? HEADER_ONLY_FIELDS : [])];
  const fkFields = fields.filter(f => f.field_name.startsWith("oid_")).map(f => f.field_name);
  const allAutoFields = [...standardFields, ...fkFields];
  const editableFields = fields.filter(f => !f.field_name.startsWith("oid_"));

  const validate = (d: Partial<FormField>, existingOid?: string) => {
    if (!d.field_name) return "Field name is required";
    if (!PG_IDENT_RE.test(d.field_name)) return "Field name must be lowercase letters, digits, underscores, starting with a letter";
    if (allAutoFields.includes(d.field_name)) return `"${d.field_name}" is a reserved auto-managed field`;
    if (d.field_name.startsWith("oid_")) return "FK fields (oid_*) are auto-managed by the Tables tab";
    if (fields.some(f => f.field_name === d.field_name && f.oid !== existingOid)) return `Field "${d.field_name}" already exists`;
    if (!d.data_type) return "Data type is required";
    return "";
  };

  const saveDraft = async (isEdit: boolean) => {
    const existing = isEdit ? editing : undefined;
    const err = validate(draft, existing?.oid);
    if (err) { setError(err); return; }
    setError("");
    setBusy(true);

    const body = {
      form_key: formKey,
      table_name: selectedTable,
      field_name: draft.field_name || "",
      data_type: draft.data_type || "text",
      max_length: draft.data_type === "text" ? (draft.max_length || null) : null,
      precision: draft.data_type === "numeric" ? (draft.precision || null) : null,
      scale: draft.data_type === "numeric" ? (draft.scale || null) : null,
      is_nullable: draft.is_nullable ?? true,
      default_value: draft.default_value || "",
      is_indexed: draft.is_indexed ?? false,
      is_unique: draft.is_unique ?? false,
      is_copyable: draft.is_copyable ?? true,
      case_sensitive: draft.data_type === "text" ? (draft.case_sensitive ?? false) : false,
      sort_order: draft.sort_order ?? 0,
    };

    try {
      if (isEdit && existing) {
        await fetch("/api/form_fields", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oid: existing.oid, ...body }),
        });
      } else {
        await fetch("/api/form_fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setAdding(false);
      setEditing(null);
      setDraft({});
      fetchFields();
    } catch {
      setError("Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const deleteField = async (fld: FormField) => {
    if (!confirm(`Delete field "${fld.field_name}"? On next generate this will DROP the column.`)) return;
    await fetch("/api/form_fields", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oid: fld.oid }),
    });
    fetchFields();
  };

  const startAdd = () => { setAdding(true); setEditing(null); setDraft({ data_type: "text", is_nullable: true, is_copyable: true, case_sensitive: false, sort_order: (fields.length + 1) * 10 }); setError(""); };
  const startEdit = (fld: FormField) => { setEditing(fld); setAdding(false); setDraft({ ...fld }); setError(""); };
  const cancel = () => { setAdding(false); setEditing(null); setDraft({}); setError(""); };

  const isFormMode = adding || editing;

  return (
    <div className="space-y-4">
      {/* Table selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Table:</span>
        <Select
          value={selectedTable}
          onChange={v => { setSelectedTable(v); setAdding(false); setEditing(null); }}
          options={tables.map(t => ({ value: t.table_name, label: `${t.table_name}${t.is_header ? " (header)" : ""}` }))}
        />
      </div>

      {/* Standard fields info */}
      <div className="rounded-lg p-3 text-xs" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <span className="font-medium">Auto-managed fields:</span>{" "}
        {allAutoFields.join(", ")}
      </div>

      {/* Fields table */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Field Name</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Type</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Nullable</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Indexed</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Default</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Order</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {editableFields.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>No custom fields yet.</td></tr>
            )}
            {editableFields.map(fld => {
              const typeLabel = fld.data_type + (fld.max_length ? `(${fld.max_length})` : "") + (fld.precision ? `(${fld.precision},${fld.scale || 0})` : "");
              return (
                <tr
                  key={fld.oid}
                  className="transition-colors cursor-pointer"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                  onClick={() => startEdit(fld)}
                >
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                    <span className="flex items-center gap-2">
                      {fld.field_name}
                      {(() => {
                        if (!row.is_generated || !row.last_generated_at) return null;
                        const gen = new Date(row.last_generated_at as string).getTime();
                        const created = new Date(fld.created_at).getTime();
                        const updated = new Date(fld.updated_at).getTime();
                        if (created > gen) return <Badge variant="warning">New</Badge>;
                        if (updated > gen) return <Badge variant="warning">Modified</Badge>;
                        return null;
                      })()}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{typeLabel}</td>
                  <td className="px-3 py-2">{fld.is_nullable ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    {fld.is_unique ? <Badge variant="warning">Unique</Badge> : fld.is_indexed ? <Badge variant="neutral">Yes</Badge> : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{fld.default_value || "—"}</td>
                  <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{fld.sort_order}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="p-1 rounded transition-colors"
                      style={{ color: "var(--danger-text)" }}
                      onClick={e => { e.stopPropagation(); deleteField(fld); }}
                      title="Delete field"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit field form */}
      {isFormMode ? (
        <div className="rounded-lg p-4 space-y-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {editing ? `Edit: ${editing.field_name}` : "Add Field"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
            <Field label="Field Name" required>
              <Input
                value={draft.field_name || ""}
                onChange={v => setDraft(d => ({ ...d, field_name: v }))}
                placeholder="e.g. vendor_code"
                readOnly={!!editing}
              />
            </Field>
            <Field label="Data Type" required>
              <Select
                value={draft.data_type || "text"}
                onChange={v => setDraft(d => ({ ...d, data_type: v }))}
                options={DATA_TYPES}
              />
            </Field>
            {draft.data_type === "text" && (
              <Field label="Max Length">
                <NumberInput
                  value={draft.max_length ?? 0}
                  onChange={v => setDraft(d => ({ ...d, max_length: v || null }))}
                  scale={0}
                  placeholder="0 = unlimited"
                />
              </Field>
            )}
            {draft.data_type === "numeric" && (
              <>
                <Field label="Precision">
                  <NumberInput
                    value={draft.precision ?? 10}
                    onChange={v => setDraft(d => ({ ...d, precision: v }))}
                    scale={0}
                  />
                </Field>
                <Field label="Scale">
                  <NumberInput
                    value={draft.scale ?? 2}
                    onChange={v => setDraft(d => ({ ...d, scale: v }))}
                    scale={0}
                  />
                </Field>
              </>
            )}
            <Field label="Default Value">
              <Input
                value={draft.default_value || ""}
                onChange={v => setDraft(d => ({ ...d, default_value: v }))}
                placeholder="SQL expression"
              />
            </Field>
            <Field label="Sort Order">
              <NumberInput
                value={draft.sort_order ?? 0}
                onChange={v => setDraft(d => ({ ...d, sort_order: v }))}
                scale={0}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Nullable">
              <Toggle value={draft.is_nullable ?? true} onChange={v => setDraft(d => ({ ...d, is_nullable: v }))} />
            </Field>
            <Field label="Indexed">
              <Toggle value={draft.is_indexed ?? false} onChange={v => setDraft(d => ({ ...d, is_indexed: v }))} />
            </Field>
            <Field label="Unique">
              <Toggle value={draft.is_unique ?? false} onChange={v => setDraft(d => ({ ...d, is_unique: v, is_indexed: v ? true : d.is_indexed }))} />
            </Field>
            {draft.data_type === "text" && (
              <Field label="Case Sensitive">
                <Toggle value={draft.case_sensitive ?? false} onChange={v => setDraft(d => ({ ...d, case_sensitive: v }))} />
              </Field>
            )}
          </div>
          {error && <div className="text-sm" style={{ color: "var(--danger-text)" }}>{error}</div>}
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
              style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
              onClick={() => saveDraft(!!editing)}
              disabled={busy}
            >
              {editing ? "Update" : "Add"}
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
          onClick={startAdd}
        >
          <Icon name="plus" size={14} /> Add Field
        </button>
      )}
    </div>
  );
}

/* ── Tabs Container ──────────────────────────────────────── */
function EntityDesignerTabs({ row, isNew, onChange, colTypes, colScales, requiredFields }: {
  row: Row; isNew: boolean; onChange: (f: keyof Row, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>; requiredFields?: string[];
}) {
  const t = useT();
  const [activeTab, setActiveTab] = useState("general");
  const isDirty = !!row.needs_generate;
  const setIsDirty = (v: boolean) => onChange("needs_generate" as keyof Row, v);

  const tabs: TabDef[] = [
    { key: "general", label: t("forms.tab_general", "General"), icon: <Icon name="settings" size={15} /> },
    { key: "tables", label: t("forms.tab_tables", "Tables"), icon: <Icon name="list" size={15} /> },
    { key: "fields", label: t("forms.tab_fields", "Fields"), icon: <Icon name="edit" size={15} /> },
  ];
  return (
    <>
      {isDirty && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm"
          style={{ background: "var(--warning-bg)", borderBottom: "1px solid var(--warning-border)", color: "var(--warning-text)" }}>
          <Icon name="alert-triangle" size={14} />
          Schema is out of sync — switch to General tab to generate
        </div>
      )}
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {activeTab === "general" && <GeneralTab row={row} isNew={isNew} onChange={onChange} colTypes={colTypes} colScales={colScales} requiredFields={requiredFields} isDirty={isDirty} setIsDirty={setIsDirty} />}
        {activeTab === "tables" && <TablesTab row={row} />}
        {activeTab === "fields" && <FieldsTab row={row} />}
      </div>
    </>
  );
}

/* ── Page Component ──────────────────────────────────────── */
export default function EntityDesigner({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();

  const columns: ColumnDef<Row>[] = useMemo(() => [
    { key: "form_key", locked: true },
    { key: "form_name" },
    { key: "has_approvals" },
    { key: "is_generated", label: "Schema",
      render: (row: Row) => {
        if (!row.is_generated) return <span style={{ color: "var(--text-muted)" }}>—</span>;
        if (row.needs_generate) return <Badge variant="warning">Out of Sync</Badge>;
        return <Badge variant="success">Generated</Badge>;
      },
    },
  ], []);

  const config = useMemo<CrudPageConfig<Row>>(() => ({
    title: t("entity_designer.title", "Entity Designer"),
    apiPath: "/api/forms",
    columns,
    renderTabs: (props) => <EntityDesignerTabs {...props} />,
  }), [t, columns]);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
