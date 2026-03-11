"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import type { LookupConfig, LookupResolveReason } from "./LookupTypes";
import { ddColKey, ddColType } from "./LookupTypes";
import { Flag } from "@/components/ui/Flag";
import { Checkbox, Input } from "@/components/ui";
import { LookupBrowseModal } from "./LookupBrowseModal";
import { useSession } from "@/context/SessionContext";

interface LookupProps {
  value: any;
  onChange: (value: any) => void;
  config: LookupConfig;
  label?: string;
  domain?: string;
  hydrateNonce?: string;
}

/** Default fetcher for local PG API routes */
async function defaultFetch(apiPath: string, params: { search: string; limit: number; offset: number; domain?: string }, baseFilters?: Record<string, string | number | boolean>) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  qs.set("limit", String(params.limit));
  qs.set("offset", String(params.offset));
  if (params.domain) qs.set("domain", params.domain);
  if (baseFilters && Object.keys(baseFilters).length) {
    const tree = { type: "group" as const, logic: "and" as const, children: Object.entries(baseFilters).map(([field, value]) => ({ type: "condition" as const, field, operator: "eq", value: String(value) })) };
    qs.set("filters", JSON.stringify(tree));
  }
  const sep = apiPath.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${apiPath}${sep}${qs}`);
    if (!res.ok) return { rows: [], total: 0 };
    const data = await res.json();
    return { rows: data.rows ?? [], total: data.total ?? 0 };
  } catch {
    return { rows: [], total: 0 };
  }
}

export function Lookup({ value, onChange, config, label, domain: domainProp, hydrateNonce }: LookupProps) {
  const {
    apiPath: _apiPath,
    dataSource,
    fetchFn,
    resolveValueFn,
    baseFilters,
    valueField,
    displayField,
    displayFormat,
    displayTemplate,
    dropdownLimit = 10,
    dropdownColumns,
    preload = false,
    browsable = true,
    multiple = false,
    checklist = false,
    checklistHeight = 260,
    checklistPageSize = 200,
    onSelect,
    onResolve,
    onClear,
    placeholder,
    readOnly = false,
    minChars = 1,
    renderRow,
    renderValue,
    allOption,
  } = config;

  // Resolve api from dataSource if no explicit apiPath
  const apiPath = _apiPath || dataSource?.api;

  const { domain: sessionDomain } = useSession();
  const effectiveDomain = domainProp || sessionDomain;

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);

  // Fixed-position dropdown to avoid overflow clipping
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; openAbove?: boolean } | null>(null);
  const updateDropdownPos = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const maxH = 280;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openAbove = spaceBelow < maxH && spaceAbove > spaceBelow;
      setDropdownPos({
        top: openAbove ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openAbove,
      });
    }
  }, []);

  // Display text for the current value (resolved from fetched record)
  const [displayText, setDisplayText] = useState("");
  const [displayRecord, setDisplayRecord] = useState<any>(null);
  // Cache of fetched records keyed by valueField
  const cache = useRef<Map<string, any>>(new Map());

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dragIdx = useRef<number>(-1);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lastHydratedValueRef = useRef<string | null>(null);
  const checklistLoadKeyRef = useRef<string>("");
  const prevChecklistHydrateNonceRef = useRef<string | undefined>(undefined);
  const promotedSelectedSnapshotRef = useRef<Set<string>>(new Set());
  const [promoteChecked, setPromoteChecked] = useState(false);

  const emitResolve = useCallback((record: any | null, reason: LookupResolveReason, resolvedValue: any) => {
    onResolve?.(record, { reason, value: resolvedValue });
  }, [onResolve]);

  // Force a fresh hydrate pass when parent row version changes (e.g. save response).
  useEffect(() => {
    lastHydratedValueRef.current = null;
  }, [hydrateNonce]);


  // Reposition dropdown on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const handler = () => updateDropdownPos();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => { window.removeEventListener("scroll", handler, true); window.removeEventListener("resize", handler); };
  }, [open, updateDropdownPos]);

  // The columns to show in the dropdown
  const ddCols = useMemo(
    () => (dropdownColumns || [valueField, ...(displayField !== valueField ? [displayField] : [])]).filter(Boolean),
    [dropdownColumns, valueField, displayField]
  );
  const ddKeys = useMemo(() => ddCols.map(ddColKey).filter(Boolean), [ddCols]);

  // Multi-select: parse value as array
  const selectedValues: string[] = useMemo(() => {
    if (!value) return [];
    if (multiple) {
      if (Array.isArray(value)) return value;
      return String(value).split(",").map(s => s.trim()).filter(Boolean);
    }
    return [String(value)];
  }, [value, multiple]);

  // Fetch function — use custom or default
  const doFetch = useCallback(
    async (searchStr: string, limit: number, offset: number) => {
      if (fetchFn) return fetchFn({ search: searchStr, limit, offset, domain: effectiveDomain });
      if (apiPath) {
        const merged = { ...(dataSource?.baseFilters ?? {}), ...(baseFilters ?? {}) };
        return defaultFetch(apiPath, { search: searchStr, limit, offset, domain: effectiveDomain }, merged);
      }
      return { rows: [], total: 0 };
    },
    [fetchFn, apiPath, baseFilters, effectiveDomain]
  );


  useEffect(() => {
    if (!checklist || !multiple) return;
    if (prevChecklistHydrateNonceRef.current === undefined) {
      prevChecklistHydrateNonceRef.current = hydrateNonce;
      return;
    }
    if (prevChecklistHydrateNonceRef.current !== hydrateNonce) {
      prevChecklistHydrateNonceRef.current = hydrateNonce;
      promotedSelectedSnapshotRef.current = new Set(selectedValues.map((v) => String(v)));
      setPromoteChecked(true);
    }
  }, [checklist, multiple, hydrateNonce, selectedValues]);

  const checklistSourceKey = useMemo(() => {
    const pageSize = Math.max(50, Number(checklistPageSize || 200));
    return JSON.stringify({
      apiPath: apiPath || "",
      domain: effectiveDomain || "",
      baseFilters: baseFilters || {},
      valueField,
      displayField,
      pageSize,
      hasFetchFn: !!fetchFn,
    });
  }, [apiPath, effectiveDomain, baseFilters, valueField, displayField, checklistPageSize, fetchFn]);

  // Resolve display text for current value(s)
  useEffect(() => {
    if (!value || (multiple && selectedValues.length === 0)) {
      setDisplayText("");
      setDisplayRecord(null);
      lastHydratedValueRef.current = null;
      return;
    }
    if (!multiple) {
      const v = String(value);
      const cached = cache.current.get(v);
      if (cached) {
        setDisplayText(formatDisplay(cached));
        setDisplayRecord(cached);
        if (lastHydratedValueRef.current !== v) {
          lastHydratedValueRef.current = v;
          emitResolve(cached, "hydrate", cached[valueField]);
        }
        return;
      }
      // Fetch the record to get display text
      const hydratePromise = resolveValueFn
        ? resolveValueFn({ value: v, domain: effectiveDomain })
            .then(match => match ? { rows: [match], total: 1 } : doFetch(v, 1, 0))
            .catch(() => doFetch(v, 1, 0))
        : doFetch(v, 1, 0);
      hydratePromise.then(data => {
        const match = (data.rows ?? []).find((r: any) => String(r[valueField]) === v);
        if (match) {
          cache.current.set(v, match);
          setDisplayText(formatDisplay(match));
          setDisplayRecord(match);
          if (lastHydratedValueRef.current !== v) {
            lastHydratedValueRef.current = v;
            emitResolve(match, "hydrate", match[valueField]);
          }
        } else {
          setDisplayText(v); // fallback to raw value
          setDisplayRecord(null);
        }
      });
    }
  }, [value, multiple, selectedValues.length, displayField, displayTemplate, doFetch, emitResolve, valueField, hydrateNonce, resolveValueFn, effectiveDomain]);

  // Preload on mount
  useEffect(() => {
    if (preload) {
      doFetch("", 200, 0).then(data => {
        setResults(data.rows);
        setTotal(data.total);
        // Cache all preloaded records
        data.rows.forEach((r: any) => cache.current.set(String(r[valueField]), r));
      });
    }
  }, [preload]);

  // Checklist mode loads all pages and renders checkbox rows.
  useEffect(() => {
    if (!checklist || !multiple) return;
    if (checklistLoadKeyRef.current === checklistSourceKey && results.length > 0) return;
    checklistLoadKeyRef.current = checklistSourceKey;

    let cancelled = false;

    const loadAllChecklistRows = async () => {
      setChecklistLoading(true);
      try {
        const rows: any[] = [];
        const pageSize = Math.max(50, Number(checklistPageSize || 200));
        for (let offset = 0; offset < 100000; offset += pageSize) {
          const data = await doFetch("", pageSize, offset);
          const batch = Array.isArray(data?.rows) ? data.rows : [];
          for (const r of batch) {
            rows.push(r);
            const key = String(r[valueField] ?? "");
            if (key) cache.current.set(key, r);
          }
          if (batch.length < pageSize) break;
        }
        if (!cancelled) {
          setResults(rows);
          setTotal(rows.length);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setChecklistLoading(false);
      }
    };

    void loadAllChecklistRows();
    return () => {
      cancelled = true;
    };
  }, [checklist, multiple, checklistSourceKey]);

  function formatDisplay(record: any): string {
    if (displayFormat) return displayFormat(record);
    if (displayTemplate) return displayTemplate.replace(/\{(\w+)\}/g, (_, k) => String(record[k] ?? ""));
    const v = record[valueField];
    const d = record[displayField];
    if (valueField === displayField || !d) return String(v ?? "");
    return `${v} — ${d}`;
  }

  // Search with debounce
  function handleSearchChange(text: string) {
    setSearch(text);
    setHighlightIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length < minChars && !preload) {
      setResults([]);
      setOpen(text.length > 0);
      return;
    }

    if (preload) {
      // Client-side filter from cached results
      setOpen(true); updateDropdownPos();
      return; // filtered in render via filteredResults
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await doFetch(text, dropdownLimit, 0);
        setResults(data.rows);
        setTotal(data.total);
        data.rows.forEach((r: any) => cache.current.set(String(r[valueField]), r));
        setOpen(true); updateDropdownPos();
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  // Client-side filter for preloaded data
  const filteredResults = useMemo(() => {
    if (!preload || !search) return results;
    const lower = search.toLowerCase();
    const searchCols = config.searchColumns || [valueField, displayField];
    return results.filter(r =>
      searchCols.some(col => String(r[col] ?? "").toLowerCase().includes(lower))
    );
  }, [preload, search, results, config.searchColumns, valueField, displayField]);

  const checklistResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cols = config.searchColumns || [valueField, displayField];
    const base = q
      ? results.filter(r => cols.some(col => String(r[col] ?? "").toLowerCase().includes(q)))
      : [...results];

    const promotedSet = promotedSelectedSnapshotRef.current;
    return [...base].sort((a, b) => {
      if (promoteChecked) {
        const aSel = promotedSet.has(String(a[valueField] ?? ""));
        const bSel = promotedSet.has(String(b[valueField] ?? ""));
        if (aSel !== bSel) return aSel ? -1 : 1;
      }

      const aLabel = String(a[displayField] ?? a[valueField] ?? "");
      const bLabel = String(b[displayField] ?? b[valueField] ?? "");
      return aLabel.localeCompare(bLabel);
    });
  }, [search, results, config.searchColumns, valueField, displayField, promoteChecked]);

  const displayResults = useMemo(() => {
    const base = preload ? filteredResults : results;
    if (!allOption) return base;
    const allRec = { [valueField]: allOption.value, [displayField]: allOption.label };
    cache.current.set(String(allOption.value), allRec);
    if (search) {
      const lower = search.toLowerCase();
      if (!allOption.label.toLowerCase().includes(lower) && !allOption.value.toLowerCase().includes(lower)) return base;
    }
    return [allRec, ...base];
  }, [preload, filteredResults, results, allOption, valueField, displayField, search]);

  // Select a record
  function selectRecord(record: any) {
    const val = record[valueField];
    cache.current.set(String(val), record);
    lastHydratedValueRef.current = String(val);

    if (multiple) {
      const existing = selectedValues.includes(String(val));
      if (!existing) {
        const newVals = [...selectedValues, String(val)];
        onChange(newVals.join(","));
      }
      setSearch("");
      inputRef.current?.focus();
    } else {
      onChange(val);
      setDisplayText(formatDisplay(record));
      setDisplayRecord(record);
      setSearch("");
      setOpen(false);
    }

    onSelect?.(record);
    emitResolve(record, "select", val);
  }


  function toggleChecklistRecord(record: any, checked: boolean) {
    const val = String(record?.[valueField] ?? "");
    if (!val) return;

    cache.current.set(val, record);
    const next = new Set(selectedValues);
    if (checked) next.add(val);
    else next.delete(val);

    onChange(Array.from(next).join(","));
    onSelect?.(record);
    emitResolve(record, "select", val);
  }

  // Remove a chip (multi-select)
  function removeChip(val: string) {
    const newVals = selectedValues.filter(v => v !== val);
    onChange(newVals.join(","));
  }

  // Clear selection
  function handleClear() {
    onChange(multiple ? "" : null);
    setDisplayText("");
    setSearch("");
    onClear?.();
    emitResolve(null, "clear", multiple ? [] : null);
    lastHydratedValueRef.current = null;
    inputRef.current?.focus();
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, displayResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0 && open) {
      e.preventDefault();
      selectRecord(displayResults[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    } else if (e.key === "Backspace" && multiple && search === "" && selectedValues.length > 0) {
      removeChip(selectedValues[selectedValues.length - 1]);
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const inContainer = containerRef.current?.contains(e.target as Node);
      const inDropdown = dropdownRef.current?.contains(e.target as Node);
      if (!inContainer && !inDropdown) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus handling
  function handleFocus() {
    if (readOnly) return;
    if (value && !multiple) {
      if (preload) {
        // Preloaded: clear search so full list is visible, select text for easy typing
        setSearch("");
      } else {
        // Remote: seed search with current display so text doesn't vanish
        setSearch(displayText || value);
      }
    }
    // For preloaded lookups, show dropdown immediately on focus
    if (preload && results.length > 0) {
      setOpen(true); updateDropdownPos();
    }
  }

  // Display chips for multi-select
  function getChipLabel(val: string): string {
    const cached = cache.current.get(val);
    if (cached && displayField !== valueField) return `${val} — ${cached[displayField]}`;
    return val;
  }

  const hasValue = multiple ? selectedValues.length > 0 : !!value;
  const showClear = hasValue && !readOnly;
  const showInput = !readOnly && (multiple || !value || open);


  if (checklist && multiple) {
    return (
      <div
        style={{
          border: "1px solid var(--input-border)",
          borderRadius: 8,
          background: readOnly ? "var(--input-bg-ro)" : "var(--input-bg)",
          padding: 8,
        }}
      >
        <Input
          value={search}
          onChange={setSearch}
          readOnly={readOnly}
          placeholder={placeholder || "Filter..."}
          style={{ marginBottom: 8 }}
        />
        <div
          style={{
            maxHeight: checklistHeight,
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-surface)",
            padding: 6,
          }}
        >
          {(checklistLoading || loading) && (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 6 }}>Loading...</div>
          )}
          {!checklistLoading && checklistResults.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 6 }}>No results found</div>
          )}
          {!checklistLoading && checklistResults.map((row, idx) => {
            const val = String(row[valueField] ?? "");
            const selected = selectedValues.includes(val);
            const secondary = valueField !== displayField ? String(row[valueField] ?? "") : "";
            const primary = String(row[displayField] ?? row[valueField] ?? "");
            return (
              <div
                key={val + "-" + idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "6px 4px",
                  borderBottom: idx < checklistResults.length - 1 ? "1px solid var(--border-light)" : "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "var(--text-primary)", fontSize: 13 }}>{primary}</div>
                  {secondary && <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{secondary}</div>}
                </div>
                <Checkbox
                  checked={selected}
                  onChange={(checked) => toggleChecklistRecord(row, checked)}
                  label=""
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} style={{ position: "relative" }}>
        {/* Hidden input carries the real value for DOM-based required validation */}
        <input type="hidden" value={multiple ? selectedValues.join(",") : (value ?? "")} />
        {/* Input area */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: multiple ? "wrap" : "nowrap",
            gap: multiple ? 4 : 0,
            background: readOnly ? "var(--input-bg-ro)" : "var(--input-bg)",
            border: `1px solid ${readOnly ? "var(--input-border-ro)" : "var(--input-border)"}`,
            borderRadius: 8,
            padding: multiple ? "4px 8px" : 0,
            minHeight: 38,
            cursor: readOnly ? "default" : "text",
            transition: "border-color 0.15s",
          }}
          onClick={() => !readOnly && inputRef.current?.focus()}
          onDragOver={multiple && !readOnly ? (e) => { e.preventDefault(); } : undefined}
          onDrop={multiple && !readOnly ? (e) => {
            e.preventDefault();
            const from = dragIdx.current;
            if (from < 0) return;
            // Find nearest chip to drop position
            const x = e.clientX;
            const y = e.clientY;
            let toIdx = selectedValues.length; // default: end
            for (let i = 0; i < chipRefs.current.length; i++) {
              const el = chipRefs.current[i];
              if (!el) continue;
              const rect = el.getBoundingClientRect();
              const midX = rect.left + rect.width / 2;
              const midY = rect.top + rect.height / 2;
              // If cursor is above this chip's row or left of its center, insert before
              if (y < rect.top + rect.height && (y < rect.top || x < midX)) {
                toIdx = i;
                break;
              }
            }
            if (from === toIdx || from + 1 === toIdx) { dragIdx.current = -1; return; }
            const arr = [...selectedValues];
            const [moved] = arr.splice(from, 1);
            const insertAt = toIdx > from ? toIdx - 1 : toIdx;
            arr.splice(insertAt, 0, moved);
            onChange(arr.join(","));
            dragIdx.current = -1;
          } : undefined}
        >
          {/* Multi-select chips (draggable for reordering) */}
          {multiple && selectedValues.map((v, i) => (
            <span
              key={v}
              ref={(el) => { chipRefs.current[i] = el; }}
              draggable={!readOnly}
              onDragStart={(e) => {
                dragIdx.current = i;
                e.currentTarget.style.opacity = "0.4";
              }}
              onDragEnd={(e) => {
                dragIdx.current = -1;
                e.currentTarget.style.opacity = "1";
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 12,
                background: "rgba(14,134,202,0.1)",
                color: "var(--section-title)",
                fontWeight: 500,
                cursor: readOnly ? "default" : "grab",
              }}
            >
              {getChipLabel(v)}
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeChip(v); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--section-title)", padding: 0, fontSize: 14, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {/* Text input or display value */}
          {showInput ? (
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              placeholder={hasValue ? "" : (placeholder || "Search...")}
              readOnly={readOnly}
              style={{
                flex: 1,
                minWidth: 80,
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: 14,
                padding: multiple ? "2px 0" : "8px 12px",
              }}
            />
          ) : (
            <span
              onClick={() => { if (!readOnly) { setOpen(true); updateDropdownPos(); setSearch(""); setTimeout(() => inputRef.current?.focus(), 0); } }}
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 14,
                color: displayText ? "var(--text-primary)" : "var(--text-muted)",
                cursor: readOnly ? "default" : "pointer",
              }}
            >
              {renderValue && value
                ? renderValue(cache.current.get(String(value)) || { [valueField]: value })
                : (() => {
                    if (!displayRecord) return displayText || placeholder || "";

                    // If displayTemplate is set, parse it into mixed text+typed-field elements
                    if (displayTemplate) {
                      const parts: React.ReactNode[] = [];
                      let last = 0;
                      const tokenRe = /\{(\w+)\}/g;
                      let m: RegExpExecArray | null;
                      while ((m = tokenRe.exec(displayTemplate)) !== null) {
                        if (m.index > last) parts.push(displayTemplate.slice(last, m.index));
                        const fieldName = m[1];
                        const typedCol = ddCols.find(dc => ddColKey(dc) === fieldName && ddColType(dc));
                        if (typedCol) {
                          const ct = ddColType(typedCol);
                          const val = displayRecord[fieldName];
                          if (ct === "flag") parts.push(<Flag key={m.index} svg={val} size={16} />);
                          else if (ct === "image") parts.push(<img key={m.index} src={val} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />);
                          else parts.push(String(displayRecord[fieldName] ?? ""));
                        } else {
                          parts.push(String(displayRecord[fieldName] ?? ""));
                        }
                        last = m.index + m[0].length;
                      }
                      if (last < displayTemplate.length) parts.push(displayTemplate.slice(last));
                      return <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{parts}</span>;
                    }

                    // No template — check if displayField itself is a typed column
                    const typedCol = ddCols.find(dc => ddColKey(dc) === displayField && ddColType(dc));
                    if (typedCol) {
                      const ct = ddColType(typedCol);
                      const val = displayRecord[displayField];
                      if (ct === "flag") return <Flag svg={val} size={16} />;
                      if (ct === "image") return <img src={val} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />;
                    }

                    return displayText || placeholder || "";
                  })()}
            </span>
          )}

          {/* Clear button */}
          {showClear && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", padding: "0 4px", fontSize: 16, lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}

          {/* Browse button */}
          {browsable && !readOnly && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setBrowseOpen(true); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", padding: "0 8px", fontSize: 14,
                flexShrink: 0,
              }}
              title="Browse"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
          )}
        </div>

        {/* Dropdown — rendered in a portal so position:fixed escapes any CSS transform ancestor (e.g. SlidePanel) */}
        {open && displayResults.length > 0 && dropdownPos && createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "var(--shadow-md)",
              maxHeight: 280,
              overflowY: "auto",
              ...(dropdownPos.openAbove
                ? { bottom: window.innerHeight - dropdownPos.top, top: "auto" }
                : { top: dropdownPos.top, bottom: "auto" }),
            }}
          >
            {displayResults.slice(0, dropdownLimit).map((row, i) => {
              const isSelected = selectedValues.includes(String(row[valueField]));
              return (
                <div
                  key={String(row[valueField]) + i}
                  onClick={() => selectRecord(row)}
                  onMouseEnter={() => setHighlightIdx(i)}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: 13,
                    background: highlightIdx === i ? "var(--bg-hover)" : isSelected ? "var(--bg-selected)" : "transparent",
                    borderBottom: i < displayResults.length - 1 ? "1px solid var(--border-light)" : "none",
                  }}
                >
                  {renderRow ? renderRow(row) : ddCols.map(col => {
                    const key = ddColKey(col);
                    const colType = ddColType(col);
                    if (colType === "flag") return <Flag key={key} svg={row[key]} size={16} />;
                    if (colType === "image") return <img key={key} src={row[key]} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />;
                    return (
                      <span
                        key={key}
                        style={{
                          color: key === valueField ? "var(--text-primary)" : "var(--text-secondary)",
                          fontWeight: key === valueField ? 500 : 400,
                          flex: key === valueField ? "0 0 auto" : 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {String(row[key] ?? "")}
                      </span>
                    );
                  })}
                </div>
              );
            })}
            {total > dropdownLimit && (
              <div
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  borderTop: "1px solid var(--border-light)",
                }}
              >
                {total} results — use browse for full list
              </div>
            )}
            {loading && (
              <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                Loading...
              </div>
            )}
          </div>
        , document.body)}

        {/* Empty state — also portalled */}
        {open && search.length >= minChars && displayResults.length === 0 && !loading && dropdownPos && createPortal(
          <div
            style={{
              position: "fixed",
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
              ...(dropdownPos.openAbove
                ? { bottom: window.innerHeight - dropdownPos.top, top: "auto" }
                : { top: dropdownPos.top, bottom: "auto" }),
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "var(--shadow-md)",
              padding: "12px",
              fontSize: 13,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            No results found
          </div>
        , document.body)}
      </div>

      {/* Browse modal */}
      {browseOpen && (
        <LookupBrowseModal
          config={config}
          onSelect={(record) => {
            selectRecord(record);
            if (!multiple) setBrowseOpen(false);
          }}
          onClose={() => setBrowseOpen(false)}
          selectedValues={selectedValues}
          label={label}
        />
      )}
    </>
  );
}
