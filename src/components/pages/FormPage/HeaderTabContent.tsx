/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
"use client";
import { Icon } from "@/components/icons/Icon";
import { useState } from "react";
import React from "react";
import { Section, Field } from "@/components/ui";
import type { LayoutEntry, Row } from "./types";
import { FieldRenderer } from "./FieldRenderer";
import { humanize } from "./utils";
import { useT } from "@/context/TranslationContext";
import { AddSectionButton } from "./AddSectionButton";
import { InlineCrud } from "@/components/inline-crud/InlineCrud";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";
import type { ColumnDef } from "@/components/data-grid/DataGrid";

// ── Position helpers ─────────────────────────────────────────────────────────

/**
 * Assign row/col to entries that don't have them, filling linearly
 * into the first available slots while respecting already-positioned entries.
 * Fields that already have row+col are returned unchanged.
 */
function assignPositions(entries: LayoutEntry[], cols: number): LayoutEntry[] {
  // Mark all cells claimed by explicitly-positioned entries
  const occupied = new Set<string>();
  for (const e of entries) {
    const r = e.properties?.row as number | undefined;
    const c = e.properties?.col as number | undefined;
    if (r != null && c != null) {
      const span = Math.min(Number(e.properties?.col_span) || 1, cols - c + 1);
      for (let sc = c; sc < c + span; sc++) occupied.add(`${r}:${sc}`);
    }
  }

  let cr = 1, cc = 1; // cursor row/col

  /** Advance cursor to next slot where `span` consecutive cols fit. */
  function advance(span: number) {
    while (true) {
      if (cc + span - 1 > cols) { cr++; cc = 1; continue; }
      let fits = true;
      for (let sc = cc; sc < cc + span; sc++) {
        if (occupied.has(`${cr}:${sc}`)) { fits = false; break; }
      }
      if (fits) return;
      cc++;
    }
  }

  return entries.map(e => {
    if (e.properties?.row != null && e.properties?.col != null) return e;
    const span = Math.min(Number(e.properties?.col_span) || 1, cols);
    advance(span);
    const result = { ...e, properties: { ...e.properties, row: cr, col: cc } };
    for (let sc = cc; sc < cc + span; sc++) occupied.add(`${cr}:${sc}`);
    cc += span;
    if (cc > cols) { cr++; cc = 1; }
    return result;
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function HeaderTabContent({
  apiPath, tableName, tabKey, layout, row, onChange,
  keyFields,
  designMode, onFieldClick, onSectionClick, onSectionAdded,
  onFieldMoved, onElementDropped, formKey, buttonHandlers,
}: {
  apiPath: string;
  tableName: string;
  tabKey: string;
  layout: LayoutEntry[];
  designMode?: boolean;
  onFieldClick?: (entry: LayoutEntry) => void;
  onSectionClick?: (entry: LayoutEntry) => void;
  onSectionAdded?: (entry: LayoutEntry) => void;
  onFieldMoved?: (oid: string, targetSection: string, targetRow: number, targetCol: number) => void;
  onElementDropped?: (data: unknown, targetSection: string, targetRow: number, targetCol: number) => void;
  formKey?: string;
  buttonHandlers?: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>>;
  row: Row;
  onChange: (field: string, value: unknown) => void;
  keyFields?: string[];
}) {
  const t = useT();
  const [draggedOid, setDraggedOid] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // "row:col:sectionKey"

  const sections = layout
    .filter(l => l.layout_type === "section" && l.table_name === tableName && l.parent_key === tabKey)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      {sections.map((sec, secIdx) => {
        const cols = sec.properties?.columns || 2;

        const entries = layout
          .filter(l =>
            (l.layout_type === "field" || l.layout_type === "child_grid") &&
            l.table_name === tableName &&
            l.parent_key === sec.layout_key &&
            !l.properties?.hidden,
          )
          .sort((a, b) => a.sort_order - b.sort_order);

        // Assign row/col to any entries missing them (migration fallback)
        const positioned = assignPositions(entries, cols);

        // Build cell map: "row:col" → entry (start cell only)
        const cellMap = new Map<string, LayoutEntry>();
        // Cells owned by a spanning entry (not the start cell)
        const ownedCells = new Set<string>();

        for (const e of positioned) {
          const er = e.properties!.row as number;
          const ec = e.properties!.col as number;
          const span = Math.min(Number(e.properties?.col_span) || 1, cols - ec + 1);
          cellMap.set(`${er}:${ec}`, e);
          for (let sc = ec + 1; sc < ec + span; sc++) {
            ownedCells.add(`${er}:${sc}`);
          }
        }

        const maxRow = positioned.length > 0
          ? Math.max(...positioned.map(e => e.properties!.row as number))
          : 0;
        // Always show one blank row at bottom in design mode for appending
        const renderRows = designMode ? maxRow + 1 : maxRow;

        // ── Drop target style helper ────────────────────────────────────────
        const dropKey = (r: number, c: number) => `${r}:${c}:${sec.layout_key}`;
        const isOver = (r: number, c: number) => dropTarget === dropKey(r, c);

        const dropHandlers = (r: number, c: number) => ({
          onDragOver: (ev: React.DragEvent) => {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
            setDropTarget(dropKey(r, c));
          },
          onDragLeave: (ev: React.DragEvent) => {
            // Only clear if leaving to outside this cell
            if (!ev.currentTarget.contains(ev.relatedTarget as Node)) {
              setDropTarget(null);
            }
          },
          onDrop: (ev: React.DragEvent) => {
            ev.preventDefault();
            ev.stopPropagation();
            const elData = ev.dataTransfer.getData("application/x-element");
            if (elData && onElementDropped) {
              onElementDropped(JSON.parse(elData), sec.layout_key, r, c);
            } else if (draggedOid && onFieldMoved) {
              onFieldMoved(draggedOid, sec.layout_key, r, c);
            }
            setDropTarget(null);
            setDraggedOid(null);
          },
        });

        // ── Render all cells ─────────────────────────────────────────────────
        const cells: React.ReactNode[] = [];

        for (let ri = 0; ri < renderRows; ri++) {
          const r = ri + 1;
          for (let ci = 0; ci < cols; ci++) {
            const c = ci + 1;
            const cellKey = `${r}:${c}`;

            // Cell owned by a spanning entry — null, CSS grid handles gap
            if (ownedCells.has(cellKey)) {
              cells.push(null);
              continue;
            }

            const entry = cellMap.get(cellKey);

            // ── Occupied cell: field or child_grid ──────────────────────────
            if (entry) {
              const span = Math.min(Number(entry.properties?.col_span) || 1, cols - c + 1);
              const cellOver = isOver(r, c);

              // child_grid — full-width inline CRUD
              if (entry.layout_type === "child_grid") {
                const childTable = entry.layout_key;
                const gridDesignStyle = designMode && onFieldClick
                  ? { cursor: "pointer", outline: "1px dashed var(--accent)", outlineOffset: 2, borderRadius: 6 }
                  : {};
                const gridClick = designMode && onFieldClick
                  ? (ev: React.MouseEvent) => { ev.stopPropagation(); onFieldClick(entry); }
                  : undefined;

                cells.push(
                  <div
                    key={cellKey}
                    draggable={!!designMode}
                    onDragStart={designMode ? (ev) => {
                      setDraggedOid(entry.oid);
                      ev.dataTransfer.effectAllowed = "move";
                      (ev.currentTarget as HTMLElement).style.opacity = "0.4";
                    } : undefined}
                    onDragEnd={designMode ? (ev) => {
                      (ev.currentTarget as HTMLElement).style.opacity = "1";
                      setDraggedOid(null);
                      setDropTarget(null);
                    } : undefined}
                    {...(designMode ? dropHandlers(r, c) : {})}
                    onClick={gridClick}
                    style={{
                      gridColumnStart: c,
                      gridRowStart: r,
                      gridColumnEnd: span > 1 ? `span ${span}` : undefined,
                      ...gridDesignStyle,
                      ...(designMode && cellOver ? {
                        outline: "2px solid var(--accent)",
                        boxShadow: "0 0 0 2px rgba(var(--accent-rgb,59,130,246),0.25)",
                      } : {}),
                    }}
                  >
                    {!row.oid ? (
                      <div style={{
                        padding: 16, textAlign: "center",
                        color: "var(--text-muted)", border: "1px dashed var(--border)", borderRadius: 8,
                      }}>
                        Save the record to add {entry.properties?.label || humanize(childTable)} items
                      </div>
                    ) : (
                      <div style={{ pointerEvents: designMode ? "none" : undefined }}>
                        <InlineCrud
                          apiPath={`${apiPath}?table=${childTable}`}
                          table={childTable}
                          columns={layout
                            .filter(l => l.layout_type === "grid_column" && l.table_name === childTable)
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map(gc => ({ key: gc.layout_key, label: gc.properties?.label })) as ColumnDef<Row>[]}
                          parentFilter={{ parentOid: row.oid, domain: row.domain }}
                          saveExtras={{ domain: row.domain, [`oid_${tableName}`]: row.oid }}
                          label={entry.properties?.show_label === false ? undefined : (entry.properties?.label || childTable)}
                          formKey={formKey}
                          buttonHandlers={buttonHandlers}
                          inquiryOnly={entry.properties?.inquiry_only === true}
                          allowAdd={entry.properties?.allow_add !== false}
                        />
                      </div>
                    )}
                  </div>
                );
                continue;
              }

              // Regular field
              const fl = entry;
              const isKeyField = !!keyFields?.includes(fl.layout_key);
              const isEditMode = !!row.oid;
              const forceReadOnly = isKeyField && isEditMode;
              cells.push(
                <div
                  key={cellKey}
                  draggable={!!designMode}
                  onDragStart={designMode ? (ev) => {
                    setDraggedOid(fl.oid);
                    ev.dataTransfer.effectAllowed = "move";
                    (ev.currentTarget as HTMLElement).style.opacity = "0.4";
                  } : undefined}
                  onDragEnd={designMode ? (ev) => {
                    (ev.currentTarget as HTMLElement).style.opacity = "1";
                    setDraggedOid(null);
                    setDropTarget(null);
                  } : undefined}
                  {...(designMode ? dropHandlers(r, c) : {})}
                  onClick={designMode && onFieldClick ? (ev) => { ev.stopPropagation(); onFieldClick(fl); } : undefined}
                  onMouseEnter={designMode && !draggedOid ? ev => {
                    (ev.currentTarget as HTMLElement).style.outline = "2px dashed var(--accent)";
                  } : undefined}
                  onMouseLeave={designMode && !draggedOid ? ev => {
                    (ev.currentTarget as HTMLElement).style.outline = cellOver ? "2px solid var(--accent)" : "2px dashed transparent";
                  } : undefined}
                  style={{
                    gridColumnStart: c,
                    gridRowStart: r,
                    gridColumnEnd: span > 1 ? `span ${span}` : undefined,
                    ...(designMode ? {
                      borderRadius: 6, padding: 4, margin: -4,
                      cursor: "grab",
                      outline: cellOver ? "2px solid var(--accent)" : "2px dashed transparent",
                      boxShadow: cellOver ? "0 0 0 2px rgba(var(--accent-rgb,59,130,246),0.25)" : "none",
                      transition: "outline 0.15s, box-shadow 0.15s",
                    } : {}),
                  }}
                >
                  <Field
                    label={designMode && (fl.properties?.readonly || isKeyField) ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>{t(`form.${formKey}.${fl.layout_key}`, fl.properties?.label || humanize(fl.layout_key))}</span>
                        <Icon name="lock" size={12} />
                      </span>
                    ) : t(`form.${formKey}.${fl.layout_key}`, fl.properties?.label || humanize(fl.layout_key))}
                    required={fl.properties?.mandatory || isKeyField}
                    hideLabel={!designMode && fl.properties?.show_label === false}
                  >
                    <FieldRenderer
                      renderer={fl.properties?.renderer || "text"}
                      value={row[fl.layout_key]}
                      onChange={v => onChange(fl.layout_key as keyof Row, v)}
                      fieldKey={fl.layout_key}
                      readOnly={fl.properties?.readonly || designMode || forceReadOnly}
                      properties={fl.properties}
                      recordOid={row.oid}
                      tableName={fl.table_name || tableName}
                      row={row}
                    />
                  </Field>
                </div>
              );
              continue;
            }

            // ── Empty cell ──────────────────────────────────────────────────
            if (!designMode) {
              // In normal mode, empty cells are invisible spacers to keep grid alignment
              cells.push(<div key={cellKey} style={{ gridColumnStart: c, gridRowStart: r }} />);
              continue;
            }

            const over = isOver(r, c);
            cells.push(
              <div
                key={cellKey}
                {...dropHandlers(r, c)}
                style={{
                  gridColumnStart: c,
                  gridRowStart: r,
                  border: `2px dashed ${over ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 6,
                  minHeight: 52,
                  background: over ? "rgba(var(--accent-rgb,59,130,246),0.06)" : "transparent",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              />,
            );
          }
        }

        return (
          <Section
            key={sec.layout_key}
            title={t(`form.${formKey}.${sec.layout_key}`, sec.properties?.label || sec.layout_key)}
            icon={sec.properties?.icon ? <Icon name={sec.properties.icon} size={13} /> : undefined}
            hideTitle={!designMode && sec.properties?.show_label === false}
            style={designMode
              ? {
                  marginTop: secIdx > 0 ? 16 : 0,
                  border: "2px dashed var(--accent)",
                  borderRadius: 8,
                  padding: 12,
                  position: "relative" as const,
                }
              : { marginTop: secIdx > 0 ? 16 : 0 }}
            titleStyle={designMode ? { cursor: "pointer", color: "var(--accent)" } : undefined}
            onClick={designMode && onSectionClick ? () => onSectionClick(sec) : undefined}
          >
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridAutoRows: "auto",
              gap: 12,
            }}>
              {cells}
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
