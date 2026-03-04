"use client";

import { SplitCrudPage } from "./SplitCrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { Section } from "@/components/ui";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "code", locked: true },
  { key: "flag_svg", hidden: true },
];

const DATE_FORMATS = [
  { value: "mdy", label: "MM/DD/YYYY" },
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "ymd", label: "YYYY/MM/DD" },
];

function Detail({ row, isNew, onChange, colTypes, colScales, requiredFields }: CrudPanelBodyProps) {
  const t = useT();
  const { field } = useFieldHelper({ row, onChange, table: "locales", colTypes: colTypes as any, colScales, requiredFields });
  return (
    <Section title={t("locales.section_settings", "Locale Settings")}>
      {field("code", { autoFocus: isNew, placeholder: t("locales.placeholder_code", "e.g. en-us") })}
      {field("description", { placeholder: t("locales.placeholder_description", "e.g. English (US)") })}
      {field("date_format", { type: "select", options: DATE_FORMATS })}
      {field("decimal_char", { maxLength: 1 })}
      {field("separator_char", { maxLength: 1 })}
      {field("is_default", { type: "checkbox", checkLabel: t("locales.default_label", "Use as system default") })}
    </Section>
  );
}

const renderBody = (props: CrudPanelBodyProps) => (
  <div className="flex-1 overflow-y-auto p-4 sm:p-5"><Detail {...props} /></div>
);

export default function Locales({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();
  return (
    <SplitCrudPage title={t("locales.title", "Locales")} table="locales"
      columns={COLUMNS} renderBody={renderBody}
      activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />
  );
}
