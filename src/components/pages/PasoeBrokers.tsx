"use client";

import { useMemo } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { Section } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "name", locked: true },
];

function Detail({ row, isNew, onChange, colTypes, colScales }: {
  row: Row; isNew: boolean; onChange: (f: keyof Row, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>;
}) {
  const t = useT();
  const { field } = useFieldHelper({ row, onChange, table: "pasoe_brokers", colTypes: colTypes as any, colScales });
  return (
    <Section title={t("pasoe_brokers.section_general", "General")}>
      {field("name", { autoFocus: isNew })}
      {field("domain")}
      {field("connect_string")}
      {field("proxy_connect")}
      {field("cacheable")}
    </Section>
  );
}

export default function PasoeBrokers({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();
  const config = useMemo((): CrudPageConfig<Row> => ({
    title: t("pasoe_brokers.title", "Application Servers"),
    apiPath: "/api/pasoe_brokers",
    columns: COLUMNS,
    renderDetail: (props) => <Detail {...props} />,
  }), []);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
