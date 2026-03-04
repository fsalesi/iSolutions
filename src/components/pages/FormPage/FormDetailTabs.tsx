"use client";
/**
 * FormDetailTabs — renders tabs with sections, fields, and child grids.
 * All tabs go through HeaderTabContent — no hardcoded child tab concept.
 */
import { useState } from "react";
import { TabBar } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import type { LayoutEntry, Row, FormMeta } from "./types";
import { HeaderTabContent } from "./HeaderTabContent";
import { AddTabButton } from "./AddTabButton";

export function FormDetailTabs({ apiPath, meta, headerTabs, row, isNew, onChange,
  designMode, onFieldClick, onSectionClick, onSectionAdded, onTabClick, onTabAdded,
  onFieldReordered, onElementDropped, onDesignToggle, onLayoutUpdated, formKey }: {
  apiPath: string; meta: FormMeta; designMode?: boolean;
  onFieldClick?: (entry: LayoutEntry) => void;
  onSectionClick?: (entry: LayoutEntry) => void;
  onSectionAdded?: (entry: LayoutEntry) => void;
  onTabClick?: (entry: LayoutEntry) => void;
  onTabAdded?: (entry: LayoutEntry) => void;
  onFieldReordered?: (oid: string, targetSection: string, targetEntryIdx: number, replaceSpacerOid?: string, appendOffset?: number) => void;
  onElementDropped?: (data: any, targetSection: string, targetEntryIdx: number, replaceSpacerOid?: string, appendOffset?: number) => void;
  onDesignToggle?: () => void;
  onLayoutUpdated?: (layout: LayoutEntry[]) => void;
  formKey?: string;
  headerTabs: LayoutEntry[];
  row: Row; isNew: boolean; onChange: (field: keyof Row, value: any) => void;
}) {
  const t = useT();
  const [activeTab, setActiveTab] = useState(headerTabs[0]?.layout_key || "general");

  const tabs = headerTabs.map(tab => ({
    key: tab.layout_key,
    label: t(`form.${formKey}.${tab.layout_key}`, tab.properties?.label || tab.layout_key),
  }));

  return (
    <div>
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
          onFieldReordered={onFieldReordered}
          onElementDropped={onElementDropped}
          onDesignToggle={onDesignToggle}
          formKey={formKey}
        />
      </div>
    </div>
  );
}
