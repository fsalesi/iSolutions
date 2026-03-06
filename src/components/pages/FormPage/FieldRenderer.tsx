/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { Toggle } from "@/components/ui/Toggle";
import { NumberInput } from "@/components/ui/NumberInput";
import { Lookup } from "@/components/lookup/Lookup";
import * as LookupPresets from "@/components/lookup/presets";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ImageField({
  value,
  onChange,
  fieldKey,
  readOnly,
  tableName,
  recordOid,
  displayName,
}: {
  value: unknown;
  onChange: (v: string | null) => void;
  fieldKey: string;
  readOnly?: boolean;
  tableName?: string;
  recordOid?: string;
  displayName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const canEdit = !readOnly && !!tableName && !!recordOid;
  const initials = useMemo(() => initialsFromName(displayName || ""), [displayName]);

  const primarySrc = typeof value === "string" && value.length > 0 ? String(value) : "";
  const fallbackSrc = recordOid ? `/api/users/photo?oid=${encodeURIComponent(recordOid)}` : "";
  const [imgSrc, setImgSrc] = useState(primarySrc);
  useEffect(() => {
    setImgSrc(primarySrc);
  }, [primarySrc]);
  const hasImage = imgSrc.length > 0;

  const upload = async (file: File) => {
    if (!canEdit || !tableName || !recordOid) return;
    const form = new FormData();
    form.append("table", tableName);
    form.append("field", fieldKey);
    form.append("oid", recordOid);
    form.append("file", file);

    setBusy(true);
    try {
      const res = await fetch("/api/blob", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(`/api/blob?table=${encodeURIComponent(tableName)}&field=${encodeURIComponent(fieldKey)}&oid=${encodeURIComponent(recordOid)}&v=${Date.now()}`);
    } catch (err) {
      console.error("Image upload failed:", err);
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!canEdit || !tableName || !recordOid) return;
    setBusy(true);
    try {
      const res = await fetch("/api/blob", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: tableName, field: fieldKey, oid: recordOid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Remove failed");
      onChange(null);
    } catch (err) {
      console.error("Image remove failed:", err);
      alert(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{ position: "relative", width: 86, height: 86 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: 86,
          height: 86,
          borderRadius: 10,
          border: "1px solid var(--border)",
          overflow: "hidden",
          background: "var(--bg-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          fontWeight: 700,
          fontSize: 22,
        }}
      >
        {hasImage ? (
          <img src={imgSrc} alt={fieldKey} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => {
            if (fallbackSrc && imgSrc !== fallbackSrc) {
              setImgSrc(fallbackSrc);
            } else {
              setImgSrc("");
            }
          }} />
        ) : (
          initials
        )}
      </div>

      {!canEdit && (
        <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 11 }}>
          {recordOid ? "Read-only" : "Save record to upload"}
        </div>
      )}

      {canEdit && hovered && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            flexDirection: "column",
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            style={{
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {busy ? "Working..." : hasImage ? "Replace" : "Upload"}
          </button>
          {hasImage && (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              style={{
                border: "1px solid rgba(255,255,255,0.45)",
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

export function FieldRenderer({
  renderer,
  value,
  onChange,
  fieldKey,
  readOnly,
  properties,
  recordOid,
  tableName,
  row,
}: {
  renderer: string;
  value: any;
  onChange: (v: any) => void;
  fieldKey: string;
  readOnly?: boolean;
  properties?: Record<string, any>;
  recordOid?: string;
  tableName?: string;
  row?: Record<string, any>;
}) {
  switch (renderer) {
    case "checkbox":
      return <Toggle value={!!value} onChange={onChange} />;
    case "date":
    case "datetime":
      return <DatePicker value={value || ""} onChange={onChange} />;
    case "number":
      return <NumberInput value={String(value ?? "")} onChange={onChange}
        scale={properties?.scale ?? 2} readOnly={readOnly} />;
    case "textarea":
      return <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} readOnly={readOnly}
        className="w-full px-3 py-2 text-sm rounded-lg"
        style={{ minHeight: 80, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }} />;
    case "select":
      return <Select value={value ?? ""} onChange={onChange}
        options={[{ value: "", label: "— Select —" }, ...(properties?.options || [])]} />;
    case "readonly":
      return <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>{value || "—"}</span>;
    case "password":
      return <Input type="password" value={String(value ?? "")} onChange={v => onChange(v)} readOnly={readOnly} autoComplete="new-password" />;
    case "image":
      return (
        <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
          <ImageField
            value={value}
            onChange={onChange}
            fieldKey={fieldKey}
            readOnly={readOnly}
            tableName={tableName}
            recordOid={recordOid}
            displayName={String(row?.full_name || row?.user_id || row?.name || "")}
          />
        </div>
      );
    case "lookup": {
      const presetName = properties?.lookup_preset as string | undefined;
      const isCustom = presetName === "__custom__";
      const presetFn = (!isCustom && presetName) ? (LookupPresets as any)[presetName] : undefined;
      if (!presetName) {
        return <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", fontStyle: "italic" }}>
          No preset selected
        </span>;
      }
      if (!isCustom && !presetFn) {
        return <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", fontStyle: "italic" }}>
          Unknown preset: {presetName}
        </span>;
      }
      const overrides: Record<string, any> = {};
      if (properties?.lookup_api_path) overrides.apiPath = properties.lookup_api_path;
      if (properties?.lookup_value_field) overrides.valueField = properties.lookup_value_field;
      if (properties?.lookup_display_field) overrides.displayField = properties.lookup_display_field;
      if (properties?.lookup_display_template) overrides.displayTemplate = properties.lookup_display_template;
      if (properties?.lookup_placeholder) overrides.placeholder = properties.lookup_placeholder;
      if (properties?.lookup_browse_title) overrides.browseTitle = properties.lookup_browse_title;
      if (properties?.lookup_multiple !== undefined) overrides.multiple = properties.lookup_multiple;
      if (properties?.lookup_browsable !== undefined) overrides.browsable = properties.lookup_browsable;
      if (properties?.lookup_preload !== undefined) overrides.preload = properties.lookup_preload;
      if (properties?.lookup_read_only !== undefined) overrides.readOnly = properties.lookup_read_only;
      if (properties?.lookup_min_chars !== undefined) overrides.minChars = properties.lookup_min_chars;
      if (properties?.lookup_dropdown_limit !== undefined) overrides.dropdownLimit = properties.lookup_dropdown_limit;
      if (properties?.lookup_search_columns) overrides.searchColumns = String(properties.lookup_search_columns).split(",").map((s: string) => s.trim()).filter(Boolean);
      if (properties?.lookup_dropdown_columns) overrides.dropdownColumns = String(properties.lookup_dropdown_columns).split(",").map((s: string) => s.trim()).filter(Boolean);
      if (properties?.lookup_grid_columns) overrides.gridColumns = String(properties.lookup_grid_columns).split(",").map((s: string) => ({ key: s.trim(), label: s.trim() }));
      if (readOnly) overrides.readOnly = true;


      const config = isCustom ? (overrides as any) : presetFn(overrides);
      if (!config.apiPath && !config.fetchFn) {
        return <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", fontStyle: "italic" }}>
          Custom lookup: set API Path and Value Field
        </span>;
      }
      if (!config.valueField) {
        return <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", fontStyle: "italic" }}>
          Lookup config missing value field
        </span>;
      }
      return <Lookup config={config} value={value ?? ""} onChange={onChange} />;
    }
    case "text":
    default:
      return <Input value={String(value ?? "")} onChange={v => onChange(v)} readOnly={readOnly} />;
  }
}
