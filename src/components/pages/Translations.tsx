"use client";

import { useMemo } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { Section } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { LocaleLookup } from "@/components/lookup/presets";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "locale", locked: true },
];

function Detail({ row, isNew, onChange, colTypes, colScales, requiredFields }: {
  row: Row; isNew: boolean; onChange: (f: keyof Row, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>; requiredFields?: string[];
}) {
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
