/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
"use client";

import type { FormField, TableInfo } from "./types";
import type { Design } from "./FormBody.controller";
import { FieldPropertiesPanel } from "./panels/FieldPropertiesPanel";
import { SectionPropertiesPanel } from "./panels/SectionPropertiesPanel";
import { TabPropertiesPanel } from "./panels/TabPropertiesPanel";
import { AddFieldPanel } from "./panels/AddFieldPanel";

export interface FormBodyProps {
  design: Design;
  tableName: string;
  formKey: string;
  fields: FormField[];
  tables?: TableInfo[];
}

export function FormBody({ design, tableName, formKey, fields, tables }: FormBodyProps) {
  const sections = design.layout
    .filter((l) => l.layout_type === "section" && l.table_name === tableName)
    .map((s) => ({ key: s.layout_key, label: s.properties?.label || s.layout_key }));

  const tabs = design.layout
    .filter((l) => l.layout_type === "tab" && l.table_name === tableName)
    .map((t) => ({ key: t.layout_key, label: t.properties?.label || t.layout_key }));

  const tabCount = tabs.length;

  const sectionColumns = design.selectedField
    ? (design.layout.find(
        (l) => l.layout_type === "section" && l.layout_key === design.selectedField!.parent_key
      )?.properties?.columns || 2)
    : 2;

  return (
    <>
      <FieldPropertiesPanel
        entry={design.selectedField}
        open={!!design.selectedField}
        onClose={() => design.setSelectedField(null)}
        onSaved={design.handleFieldSaved}
        onDeleted={design.handleFieldDeleted}
        sections={sections}
        sectionColumns={sectionColumns}
        layoutEntries={design.layout}
      />

      <SectionPropertiesPanel
        entry={design.selectedSection}
        open={!!design.selectedSection}
        onClose={() => design.setSelectedSection(null)}
        onSaved={design.handleSectionSaved}
        onDeleted={design.handleSectionDeleted}
        tabs={tabs}
      />

      <TabPropertiesPanel
        entry={design.selectedTab}
        open={!!design.selectedTab}
        onClose={() => design.setSelectedTab(null)}
        onSaved={design.handleTabSaved}
        onDeleted={design.handleTabDeleted}
        tabCount={tabCount}
      />

      <AddFieldPanel
        open={!!design.designMode}
        onClose={() => {}}
        onAdded={design.handleFieldAdded}
        layout={design.layout}
        fields={fields}
        formKey={formKey}
        tableName={tableName}
        tables={tables}
        sections={sections}
      />
    </>
  );
}
