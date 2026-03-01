"use client";

import { useMemo, useState, useEffect } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { Section, Field, Input, Select } from "@/components/ui";
import { useT } from "@/context/TranslationContext";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "locale", label: "Locale", locked: true },
  { key: "namespace", label: "Namespace" },
  { key: "key", label: "Key" },
  { key: "value", label: "Value" },
];

function Detail({ row, isNew, onChange }: { row: Row; isNew: boolean; onChange: (f: keyof Row, v: any) => void }) {
  const t = useT();
  const [localeOptions, setLocaleOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/locales?limit=100")
      .then(r => r.json())
      .then(d => setLocaleOptions(d.rows.map((l: any) => ({ value: l.code, label: `${l.code} — ${l.description}` }))))
      .catch(() => {});
  }, []);

  return (
    <Section title={t("translations.section_translation", "Translation")}>
      <Field label={t("translations.locale", "Locale")}><Select value={row.locale} onChange={v => onChange("locale", v)} options={localeOptions} /></Field>
      <Field label={t("translations.namespace", "Namespace")}><Input value={row.namespace} onChange={v => onChange("namespace", v)} placeholder="e.g. global, users, messages" /></Field>
      <Field label={t("translations.key", "Key")}><Input value={row.key} onChange={v => onChange("key", v)} autoFocus={isNew} placeholder="e.g. full_name, save_button" /></Field>
      <Field label={t("translations.value", "Value")}><Input value={row.value} onChange={v => onChange("value", v)} placeholder="Translated text" /></Field>
    </Section>
  );
}

export default function Translations({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();
  const config = useMemo((): CrudPageConfig<Row> => ({
    title: t("translations.title", "Translations"),
    apiPath: "/api/translations",
    columns: COLUMNS,
    renderDetail: (props) => <Detail {...props} />,
  }), []);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
