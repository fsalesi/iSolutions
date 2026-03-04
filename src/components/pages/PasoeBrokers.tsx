"use client";

import { SplitCrudPage } from "./SplitCrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { Section } from "@/components/ui";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "name", locked: true },
];

function Detail({ row, isNew, onChange, colTypes, colScales, requiredFields }: CrudPanelBodyProps) {
  const t = useT();
  const { field } = useFieldHelper({ row, onChange, table: "pasoe_brokers", colTypes: colTypes as any, colScales, requiredFields });
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

const renderBody = (props: CrudPanelBodyProps) => (
  <div className="flex-1 overflow-y-auto p-4 sm:p-5"><Detail {...props} /></div>
);

export default function PasoeBrokers({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();
  return (
    <SplitCrudPage title={t("pasoe_brokers.title", "Application Servers")} table="pasoe_brokers"
      columns={COLUMNS} renderBody={renderBody}
      activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />
  );
}
