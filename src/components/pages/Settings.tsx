"use client";

import { useMemo, useEffect } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { Section } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "setting_name", locked: true },
  { key: "owner", hidden: true },
  { key: "form", hidden: true },
  { key: "domain" },
  { key: "value" },
];

function Detail({ row, isNew, onChange, colTypes, colScales }: {
  row: Row; isNew: boolean; onChange: (f: keyof Row, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>;
}) {
  const t = useT();
  const { field } = useFieldHelper({ row, onChange, table: "settings", colTypes: colTypes as any, colScales });

  useEffect(() => {
    if (!row.owner) onChange("owner", "SYSTEM");
    if (!row.domain) onChange("domain", "*");
  }, [row.owner, row.domain, onChange]);

  return (
    <Section title={t("settings.section_general", "General")}>
      {field("setting_name", { required: true, autoFocus: isNew })}
      {field("domain", { type: "select", options: [{ value: "*", label: "All Domains" }] })}
      {field("value")}
      {field("help_text")}
    </Section>
  );
}

export default function Settings({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();
  const config = useMemo((): CrudPageConfig<Row> => ({
    title: t("settings.title", "System Settings"),
    apiPath: "/api/settings",
    columns: COLUMNS,
    defaultValues: { owner: "SYSTEM", domain: "*", form: "" },
    renderDetail: (props) => <Detail {...props} />,
  }), [t]);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
