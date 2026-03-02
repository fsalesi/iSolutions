"use client";

import { useMemo } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { Section } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";

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

function Detail({ row, isNew, onChange, colTypes, colScales }: {
  row: Row; isNew: boolean; onChange: (f: keyof Row, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>;
}) {
  const t = useT();
  const { field } = useFieldHelper({ row, onChange, table: "locales", colTypes: colTypes as any, colScales });
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

export default function Locales({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();
  const config = useMemo((): CrudPageConfig<Row> => ({
    title: t("locales.title", "Locales"),
    apiPath: "/api/locales",
    columns: COLUMNS,
    renderDetail: (props) => <Detail {...props} />,
  }), []);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
