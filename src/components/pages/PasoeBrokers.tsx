"use client";

import { useMemo, useCallback } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { Section, Field, Input, Checkbox, Badge } from "@/components/ui";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "name", label: "Name", locked: true },
  { key: "domain", label: "Domain" },
  { key: "connect_string", label: "Connect String" },
  { key: "cacheable" as any, label: "Cacheable", render: (r) => <Badge variant={r.cacheable ? "success" : "neutral"}>{r.cacheable ? "Yes" : "No"}</Badge> },
  { key: "proxy_connect", label: "Proxy Connect" },
];

function Detail({ row, isNew, onChange }: { row: Row; isNew: boolean; onChange: (f: keyof Row, v: any) => void }) {
  return (
    <Section title="General">
      <Field label="Name"><Input value={row.name} onChange={v => onChange("name", v)} autoFocus={isNew} /></Field>
      <Field label="Domain"><Input value={row.domain} onChange={v => onChange("domain", v)} /></Field>
      <Field label="Connect String"><Input value={row.connect_string} onChange={v => onChange("connect_string", v)} /></Field>
      <Field label="Proxy Connect"><Input value={row.proxy_connect} onChange={v => onChange("proxy_connect", v)} /></Field>
      <Field label="Cacheable"><Checkbox checked={row.cacheable} onChange={v => onChange("cacheable", v)} label="Cache broker lookups" /></Field>
    </Section>
  );
}

export default function PasoeBrokers({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const config = useMemo((): CrudPageConfig<Row> => ({
    title: "Application Servers",
    apiPath: "/api/pasoe_brokers",
    columns: COLUMNS,
    renderDetail: (props) => <Detail {...props} />,
  }), []);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
