"use client";
/**
 * FormDetailTabs — renders tabs with sections, fields, and child grids.
 * All tabs go through HeaderTabContent — no hardcoded child tab concept.
 */
import { useState } from "react";
import { TabBar } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useSession } from "@/context/SessionContext";
import { Icon } from "@/components/icons/Icon";
import type { LayoutEntry, Row, FormMeta } from "./types";
import { HeaderTabContent } from "./HeaderTabContent";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";
import { AddTabButton } from "./AddTabButton";

export function FormDetailTabs({ apiPath, meta, headerTabs, row, isNew, onChange,
  designMode, onFieldClick, onSectionClick, onSectionAdded, onTabClick, onTabAdded,
  onFieldMoved, onElementDropped, onDesignToggle, onLayoutUpdated, formKey, buttonHandlers }: {
  apiPath: string; meta: FormMeta; designMode?: boolean;
  onFieldClick?: (entry: LayoutEntry) => void;
  onSectionClick?: (entry: LayoutEntry) => void;
  onSectionAdded?: (entry: LayoutEntry) => void;
  onTabClick?: (entry: LayoutEntry) => void;
  onTabAdded?: (entry: LayoutEntry) => void;
  onFieldMoved?: (oid: string, targetSection: string, targetRow: number, targetCol: number) => void;
  onElementDropped?: (data: any, targetSection: string, targetRow: number, targetCol: number) => void;
  onDesignToggle?: () => void;
  onLayoutUpdated?: (layout: LayoutEntry[]) => void;
  formKey?: string;
  buttonHandlers?: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>>;
  headerTabs: LayoutEntry[];
  row: Row; isNew: boolean; onChange: (field: keyof Row, value: any) => void;
}) {
  const t = useT();
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState(headerTabs[0]?.layout_key || "general");

  const tabs = headerTabs.map(tab => ({
    key: tab.layout_key,
    label: t(`form.${formKey}.${tab.layout_key}`, tab.properties?.label || tab.layout_key),
    icon: tab.properties?.icon ? <Icon name={tab.properties.icon} size={14} /> : undefined,
  }));

  const showDesignIcon = !!user?.isAdmin && !!onDesignToggle;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {showDesignIcon && (
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
          onMouseEnter={e => { if (!designMode) e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { if (!designMode) e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <Icon name={designMode ? "check" : "settings"} size={15} />
          {designMode && <span>Done</span>}
        </button>
      )}

      {(tabs.length > 1 || designMode) && (
        <TabBar
          tabs={tabs}
          active={activeTab}
          onChange={setActiveTab}
          onEditTab={onTabClick ? (key) => {
            const tab = headerTabs.find(t => t.layout_key === key);
            if (tab) onTabClick(tab);
          } : undefined}
          trailing={onTabAdded ? (
            <AddTabButton layout={meta.layout} tableName={meta.headerTable} onAdded={onTabAdded} />
          ) : undefined}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <HeaderTabContent
          apiPath={apiPath}
          tableName={meta.headerTable}
          tabKey={activeTab}
          layout={meta.layout}
          row={row}
          onChange={onChange}
          isNew={isNew}
          designMode={designMode}
          onFieldClick={onFieldClick}
          onSectionClick={onSectionClick}
          onSectionAdded={onSectionAdded}
          onFieldMoved={onFieldMoved}
          onElementDropped={onElementDropped}
          onDesignToggle={onDesignToggle}
          formKey={formKey}
          buttonHandlers={buttonHandlers}
        />
      </div>
    </div>
  );
}
