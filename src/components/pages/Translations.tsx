"use client";

import { SplitCrudPage } from "./SplitCrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { Section } from "@/components/ui";
import { LocaleLookup } from "@/components/lookup/presets";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "locale", locked: true },
];

function Detail({ row, isNew, onChange, colTypes, colScales, requiredFields }: CrudPanelBodyProps) {
  const t = useT();
  const { field } = useFieldHelper({ row, onChange, table: "translations", colTypes: colTypes as any, colScales, requiredFields });
  return (
    <Section title={t("translations.section_translation", "Translation")}>
      {field("locale", { type: "lookup", lookup: LocaleLookup() })}
      {field("namespace", { placeholder: t("translations.placeholder_namespace", "e.g. global, users, messages") })}
      {field("key", { autoFocus: isNew, placeholder: t("translations.placeholder_key", "e.g. full_name, save_button") })}
      {field("value", { placeholder: t("translations.placeholder_value", "Translated text") })}
    </Section>
  );
}

const renderBody = (props: CrudPanelBodyProps) => (
  <div className="flex-1 overflow-y-auto p-4 sm:p-5"><Detail {...props} /></div>
);

export default function Translations({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();
  return (
    <SplitCrudPage title={t("translations.title", "Translations")} table="translations"
      columns={COLUMNS} renderBody={renderBody}
      activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />
  );
}
