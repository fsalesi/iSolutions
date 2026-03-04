"use client";
import { useState } from "react";
import React from "react";
import { Section, Field } from "@/components/ui";
import type { LayoutEntry, Row } from "./types";
import { FieldRenderer } from "./FieldRenderer";
import { humanize } from "./utils";
import { useT } from "@/context/TranslationContext";
import { AddSectionButton } from "./AddSectionButton";
import { InlineCrud } from "@/components/inline-crud/InlineCrud";
import type { ColumnDef } from "@/components/data-grid/DataGrid";

export function HeaderTabContent({ apiPath, tableName, tabKey, layout, row, onChange, isNew, designMode, onFieldClick, onSectionClick, onSectionAdded, onFieldReordered, onElementDropped, onDesignToggle, formKey }: {
  apiPath: string; tableName: string; tabKey: string; layout: LayoutEntry[]; designMode?: boolean; onFieldClick?: (entry: LayoutEntry) => void;
  onSectionClick?: (entry: LayoutEntry) => void; onSectionAdded?: (entry: LayoutEntry) => void;
  onFieldReordered?: (oid: string, targetSection: string, targetEntryIdx: number, replaceSpacerOid?: string, appendOffset?: number) => void;
  onElementDropped?: (data: any, targetSection: string, targetEntryIdx: number, replaceSpacerOid?: string, appendOffset?: number) => void;
  onDesignToggle?: () => void;
  formKey?: string;
  row: Row; onChange: (field: keyof Row, value: any) => void; isNew: boolean;
}) {
  const t = useT();
  const [draggedOid, setDraggedOid] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ sectionKey: string; index: number } | null>(null);
  const sections = layout
    .filter(l => l.layout_type === "section" && l.table_name === tableName && l.parent_key === tabKey)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      {sections.map(sec => {
        const entries = layout
          .filter(l => (l.layout_type === "field" || l.layout_type === "spacer" || l.layout_type === "child_grid") && l.table_name === tableName && l.parent_key === sec.layout_key && (!l.properties?.hidden))
          .sort((a, b) => a.sort_order - b.sort_order);
        const fields = entries.filter(l => l.layout_type === "field");

        const cols = sec.properties?.columns || 2;

        return (
          <Section
            key={sec.layout_key}
            title={t(`form.${formKey}.${sec.layout_key}`, sec.properties?.label || sec.layout_key)}
            style={designMode ? {
              border: "2px dashed var(--accent)",
              borderRadius: 8,
              padding: 12,
              position: "relative" as const,
            } : undefined}
            titleStyle={designMode ? { cursor: "pointer", color: "var(--accent)" } : undefined}
            onClick={designMode && onSectionClick ? () => onSectionClick(sec) : undefined}
          >
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
              {(() => {
                // Build cells from entries (fields + spacers)
                type Cell =
                  | { kind: "field"; fl: LayoutEntry; entryIdx: number }
                  | { kind: "spacer"; entry: LayoutEntry; entryIdx: number }
                  | { kind: "empty"; tailOffset: number; entryIdx: number; cellKey: string };
                const cells: Cell[] = [];
                let cursor = 0;
                let emptyId = 0;

                for (let i = 0; i < entries.length; i++) {
                  const e = entries[i];
                  const span = Math.min(Number(e.properties?.col_span) || 1, cols);
                  if (cursor > 0 && cursor + span > cols) {
                    while (cursor < cols) {
                      cells.push({ kind: "empty", tailOffset: -1, entryIdx: i, cellKey: `gap-${emptyId++}` });
                      cursor++;
                    }
                    cursor = 0;
                  }
                  if (e.layout_type === "spacer") {
                    cells.push({ kind: "spacer", entry: e, entryIdx: i });
                  } else {
                    cells.push({ kind: "field", fl: e, entryIdx: i });
                  }
                  cursor += span;
                  if (cursor >= cols) cursor = 0;
                }

                // Fill tail
                let tailPos = 0;
                if (cursor > 0) {
                  while (cursor < cols) {
                    cells.push({ kind: "empty", tailOffset: tailPos++, entryIdx: entries.length, cellKey: `tail-${emptyId++}` });
                    cursor++;
                  }
                }
                // Append row in design mode
                if (designMode) {
                  for (let c = 0; c < cols; c++) {
                    cells.push({ kind: "empty", tailOffset: tailPos++, entryIdx: entries.length, cellKey: `append-${emptyId++}` });
                  }
                }

                // Helper: drop target style + handlers
                const dropCellStyle = (dk: string) => {
                  const isOver = dropTarget?.sectionKey === dk;
                  return {
                    style: {
                      border: `2px dashed ${isOver ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 6, padding: 16, minHeight: 48,
                      transition: "border-color 0.15s, background 0.15s",
                      background: isOver ? "rgba(var(--accent-rgb, 59, 130, 246), 0.06)" : "transparent",
                    } as React.CSSProperties,
                    onDragOver: (ev: React.DragEvent) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; setDropTarget({ sectionKey: dk, index: 0 }); },
                    onDragLeave: () => setDropTarget(null),
                  };
                };

                return cells.map((cell, ci) => {
                  // Spacers: drop targets in design mode, empty space otherwise
                  if (cell.kind === "spacer") {
                    if (!designMode) return <div key={cell.entry.oid} />;
                    const dk = `${sec.layout_key}:spacer-${cell.entry.oid}`;
                    const ds = dropCellStyle(dk);
                    return (
                      <div key={cell.entry.oid} {...ds}
                        onDrop={(ev) => {
                          ev.preventDefault();
                          const elData = ev.dataTransfer.getData("application/x-element");
                          if (elData && onElementDropped) {
                            onElementDropped(JSON.parse(elData), sec.layout_key, cell.entryIdx, cell.entry.oid);
                          } else if (draggedOid && onFieldReordered) {
                            onFieldReordered(draggedOid, sec.layout_key, cell.entryIdx, cell.entry.oid);
                          }
                          setDropTarget(null); setDraggedOid(null);
                        }}
                      />
                    );
                  }

                  // Empty cells: drop targets that create spacers
                  if (cell.kind === "empty") {
                    if (!designMode) return null;
                    const dk = `${sec.layout_key}:${cell.cellKey}`;
                    const ds = dropCellStyle(dk);
                    return (
                      <div key={cell.cellKey} {...ds}
                        onDrop={(ev) => {
                          ev.preventDefault();
                          const elData = ev.dataTransfer.getData("application/x-element");
                          if (elData && onElementDropped) {
                            if (cell.tailOffset >= 0) {
                              onElementDropped(JSON.parse(elData), sec.layout_key, entries.length, undefined, cell.tailOffset);
                            } else {
                              onElementDropped(JSON.parse(elData), sec.layout_key, cell.entryIdx);
                            }
                          } else if (draggedOid && onFieldReordered) {
                            if (cell.tailOffset >= 0) {
                              onFieldReordered(draggedOid, sec.layout_key, entries.length, undefined, cell.tailOffset);
                            } else {
                              onFieldReordered(draggedOid, sec.layout_key, cell.entryIdx);
                            }
                          }
                          setDropTarget(null); setDraggedOid(null);
                        }}
                      />
                    );
                  }

                  // Child grids — full-width inline CRUD
                  if (cell.kind === "field" && cell.fl.layout_type === "child_grid") {
                    const childTable = cell.fl.layout_key;
                    const gridDesignStyle = designMode && onFieldClick ? { cursor: "pointer", outline: "1px dashed var(--accent)", outlineOffset: 2, borderRadius: 6 } : {};
                    const gridClick = designMode && onFieldClick ? (ev: React.MouseEvent) => { ev.stopPropagation(); onFieldClick(cell.fl); } : undefined;
                    // No parent oid yet — show placeholder until parent is saved
                    if (!row.oid) {
                      return (
                        <div key={cell.fl.layout_key} onClick={gridClick} style={{ gridColumn: "1 / -1", padding: 16, textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--border)", borderRadius: 8, ...gridDesignStyle }}>
                          Save the record to add {cell.fl.properties?.label || humanize(childTable)} items
                        </div>
                      );
                    }
                    const childCols: ColumnDef<any>[] = layout
                      .filter(l => l.layout_type === "grid_column" && l.table_name === childTable)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map(gc => ({ key: gc.layout_key, label: gc.properties?.label }));
                    return (
                      <div key={cell.fl.layout_key} onClick={gridClick} style={{ gridColumn: "1 / -1", ...gridDesignStyle }}>
                        <div style={{ pointerEvents: designMode ? "none" : undefined }}>
                          <InlineCrud
                            apiPath={`${apiPath}?table=${childTable}`}
                            table={childTable}
                            columns={childCols}
                            parentFilter={{ parentOid: row.oid, domain: row.domain }}
                            saveExtras={{ domain: row.domain, [`oid_${tableName}`]: row.oid }}
                            label={cell.fl.properties?.label || childTable}
                            formKey={formKey}
                          />
                        </div>
                      </div>
                    );
                  }

                  // Fields
                  const { fl, entryIdx } = cell;
                  const span = Number(fl.properties?.col_span) || 1;
                  const fieldDk = `${sec.layout_key}:field-${fl.oid}`;
                  const isFieldOver = dropTarget?.sectionKey === fieldDk;
                  return (
                    <div
                      key={fl.layout_key}
                      draggable={!!designMode}
                      onDragStart={designMode ? (ev) => {
                        setDraggedOid(fl.oid);
                        ev.dataTransfer.effectAllowed = "move";
                        (ev.currentTarget as HTMLElement).style.opacity = "0.4";
                      } : undefined}
                      onDragEnd={designMode ? (ev) => {
                        (ev.currentTarget as HTMLElement).style.opacity = "1";
                        setDraggedOid(null); setDropTarget(null);
                      } : undefined}
                      onDragOver={designMode ? (ev) => {
                        ev.preventDefault(); ev.dataTransfer.dropEffect = "move";
                        setDropTarget({ sectionKey: fieldDk, index: 0 });
                      } : undefined}
                      onDrop={designMode ? (ev) => {
                        ev.preventDefault();
                        const elData = ev.dataTransfer.getData("application/x-element");
                        if (elData && onElementDropped) {
                          onElementDropped(JSON.parse(elData), sec.layout_key, entryIdx);
                        } else if (draggedOid && draggedOid !== fl.oid && onFieldReordered) {
                          onFieldReordered(draggedOid, sec.layout_key, entryIdx);
                        }
                        setDropTarget(null); setDraggedOid(null);
                      } : undefined}
                      style={{
                        gridColumn: span > 1 ? (span >= cols ? "1 / -1" : `span ${span}`) : undefined,
                        ...(designMode ? {
                          borderRadius: 6, padding: 4, margin: -4, cursor: "grab",
                          opacity: 1,
                          transition: "outline 0.15s, box-shadow 0.15s",
                          outline: isFieldOver ? "2px solid var(--accent)" : "2px dashed transparent",
                          boxShadow: isFieldOver ? "0 0 0 2px rgba(var(--accent-rgb, 59, 130, 246), 0.25)" : "none",
                        } : {}),
                      }}
                      onClick={designMode && onFieldClick ? (ev) => { ev.stopPropagation(); onFieldClick(fl); } : undefined}
                      onMouseEnter={designMode && !draggedOid ? ev => { (ev.currentTarget as HTMLElement).style.outline = "2px dashed var(--accent)"; } : undefined}
                      onMouseLeave={designMode && !draggedOid ? ev => { (ev.currentTarget as HTMLElement).style.outline = "2px dashed transparent"; } : undefined}
                    >
                      <Field label={t(`form.${formKey}.${fl.layout_key}`, fl.properties?.label || humanize(fl.layout_key))} required={fl.properties?.mandatory}>
                        <FieldRenderer
                          renderer={fl.properties?.renderer || "text"}
                          value={row[fl.layout_key]}
                          onChange={v => onChange(fl.layout_key as keyof Row, v)}
                          fieldKey={fl.layout_key}
                          readOnly={fl.properties?.readonly || designMode}
                          properties={fl.properties}
                        />
                      </Field>
                    </div>
                  );
                });
              })()}
            </div>
          </Section>
        );
      })}
      {designMode && onSectionAdded && (
        <AddSectionButton tabKey={tabKey} tableName={tableName} layout={layout} onAdded={onSectionAdded} />
      )}
    </div>
  );
}

