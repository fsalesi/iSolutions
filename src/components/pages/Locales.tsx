"use client";

import { useMemo } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { Section, Field, Input, Checkbox, Select, Badge } from "@/components/ui";
import { useT } from "@/context/TranslationContext";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "code", label: "Code", locked: true },
  { key: "description", label: "Description" },
  { key: "date_format", label: "Date Format" },
  { key: "decimal_char", label: "Decimal" },
  { key: "separator_char", label: "Separator" },
  { key: "is_default" as any, label: "Default", render: (r) => r.is_default ? <Badge variant="success">Default</Badge> : null },
];

const DATE_FORMATS = [
  { value: "mdy", label: "MM/DD/YYYY" },
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "ymd", label: "YYYY/MM/DD" },
];

function Detail({ row, isNew, onChange }: { row: Row; isNew: boolean; onChange: (f: keyof Row, v: any) => void }) {
  const t = useT();
  return (
    <Section title={t("locales.section_settings", "Locale Settings")}>
      <Field label={t("locales.code", "Code")}><Input value={row.code} onChange={v => onChange("code", v)} autoFocus={isNew} placeholder="e.g. en-us" /></Field>
      <Field label={t("locales.description", "Description")}><Input value={row.description} onChange={v => onChange("description", v)} placeholder="e.g. English (US)" /></Field>
      <Field label={t("locales.date_format", "Date Format")}><Select value={row.date_format} onChange={v => onChange("date_format", v)} options={DATE_FORMATS} /></Field>
      <Field label={t("locales.decimal_char", "Decimal Character")}><Input value={row.decimal_char} onChange={v => onChange("decimal_char", v)} maxLength={1} /></Field>
      <Field label={t("locales.separator_char", "Thousands Separator")}><Input value={row.separator_char} onChange={v => onChange("separator_char", v)} maxLength={1} /></Field>
      <Field label={t("locales.is_default", "Default Locale")}><Checkbox checked={row.is_default} onChange={v => onChange("is_default", v)} label={t("locales.default_label", "Use as system default")} /></Field>
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
