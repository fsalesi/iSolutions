"use client";

import { useState } from "react";
import type { LayoutEntry, Row } from "./types";
import { humanize } from "./utils";
import { Icon } from "@/components/icons/Icon";
import { HeaderTabContent } from "./HeaderTabContent";
import { AddTabButton } from "./AddTabButton";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";

export interface FormBodyCanvasProps {
  apiPath: string;
  tableName: string;
  layout: LayoutEntry[];
  row: Row;
  onChange: (field: string, value: unknown) => void;
  designMode?: boolean;
  onFieldClick?: (entry: LayoutEntry) => void;
  onSectionClick?: (entry: LayoutEntry) => void;
  onSectionAdded?: (entry: LayoutEntry) => void;
  onTabClick?: (entry: LayoutEntry) => void;
  onTabAdded?: (entry: LayoutEntry) => void;
  onFieldMoved?: (oid: string, targetSection: string, targetRow: number, targetCol: number) => void;
  onElementDropped?: (data: unknown, targetSection: string, targetRow: number, targetCol: number) => void;
  onDesignToggle?: () => void;
  formKey?: string;
  buttonHandlers?: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>>;
  fallbackTabKey?: string;
  getTabLabel?: (tab: LayoutEntry) => string;
}

export function FormBodyCanvas({
  apiPath,
  tableName,
  layout,
  row,
  onChange,
  designMode,
  onFieldClick,
  onSectionClick,
  onSectionAdded,
  onTabClick,
  onTabAdded,
  onFieldMoved,
  onElementDropped,
  onDesignToggle,
  formKey,
  buttonHandlers,
  fallbackTabKey,
  getTabLabel,
}: FormBodyCanvasProps) {
  const [activeTabKey, setActiveTabKey] = useState<string>("");

  const layoutTabs = layout
    .filter((l) => l.layout_type === "tab" && l.table_name === tableName)
    .sort((a, b) => a.sort_order - b.sort_order);

  const effectiveTabKey = activeTabKey || layoutTabs[0]?.layout_key || fallbackTabKey || "general";

  return (
    <div style={{ position: "relative" }}>
      {onDesignToggle && (
        <button
          onClick={onDesignToggle}
          title={designMode ? "Exit design mode" : "Design layout"}
          style={{
            position: "absolute", top: 6, right: 8, zIndex: 10,
            background: designMode ? "var(--accent)" : "var(--bg-secondary)",
            color: designMode ? "var(--accent-text)" : "var(--text-secondary)",
            border: `1px solid ${designMode ? "transparent" : "var(--border)"}`,
            borderRadius: 6, padding: "5px 9px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 12, fontWeight: 500,
            opacity: designMode ? 1 : 0.85,
          }}
          onMouseEnter={(e) => { if (!designMode) e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { if (!designMode) e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <Icon name={designMode ? "check" : "settings"} size={15} />
          {designMode && <span>Done</span>}
        </button>
      )}

      {(layoutTabs.length > 1 || designMode) && (
        <div
          className="flex overflow-x-auto px-2"
          style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}
        >
          {layoutTabs.map((tab) => {
            const label = getTabLabel?.(tab) || tab.properties?.label || humanize(tab.layout_key);
            const icon = tab.properties?.icon || "";
            return (
              <button
                key={tab.layout_key}
                onClick={() => setActiveTabKey(tab.layout_key)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  borderBottom: `2px solid ${effectiveTabKey === tab.layout_key ? "var(--accent)" : "transparent"}`,
                  color: effectiveTabKey === tab.layout_key ? "var(--accent)" : "var(--text-secondary)",
                }}
                onDoubleClick={designMode && onTabClick ? () => onTabClick(tab) : undefined}
              >
                {icon && <Icon name={icon} size={14} />}
                {label}
              </button>
            );
          })}
          {designMode && onTabAdded && (
            <AddTabButton layout={layout} tableName={tableName} onAdded={onTabAdded} />
          )}
        </div>
      )}

      <div style={{ padding: "8px 16px" }}>
        <HeaderTabContent
          apiPath={apiPath}
          tableName={tableName}
          tabKey={effectiveTabKey}
          layout={layout}
          row={row}
          onChange={onChange}
          designMode={designMode}
          onFieldClick={onFieldClick}
          onSectionClick={onSectionClick}
          onSectionAdded={onSectionAdded}
          onFieldMoved={onFieldMoved}
          onElementDropped={onElementDropped}
          formKey={formKey}
          buttonHandlers={buttonHandlers}
        />
      </div>
    </div>
  );
}
