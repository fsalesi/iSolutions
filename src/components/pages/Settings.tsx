"use client";

import { useEffect } from "react";
import { SplitCrudPage } from "./SplitCrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { Section } from "@/components/ui";
import { DomainLookup } from "@/components/lookup/presets";

type Row = { oid: string; [key: string]: any };

const COLUMNS: ColumnDef<Row>[] = [
  { key: "setting_name", locked: true },
  { key: "owner", hidden: true },
  { key: "form", hidden: true },
  { key: "domain" },
  { key: "value" },
];

const DEFAULTS = { owner: "SYSTEM", domain: "*", form: "*" };

function Detail({ row, isNew, onChange, colTypes, colScales, requiredFields }: CrudPanelBodyProps) {
  const t = useT();
  const { field } = useFieldHelper({ row, onChange, table: "settings", colTypes: colTypes as any, colScales, requiredFields });

  useEffect(() => {
    if (!row.owner) onChange("owner", "SYSTEM");
    if (!row.domain) onChange("domain", "*");
  }, [row.owner, row.domain, onChange]);

  return (
    <Section title={t("settings.section_general", "General")}>
      {field("setting_name", { autoFocus: isNew })}
      {field("domain", { type: "lookup", lookup: DomainLookup({ allOption: { value: "*", label: t("settings.all_domains", "All Domains") } }) })}
      {field("value")}
      {field("help_text")}
    </Section>
  );
}

const renderBody = (props: CrudPanelBodyProps) => (
  <div className="flex-1 overflow-y-auto p-4 sm:p-5"><Detail {...props} /></div>
);

export default function Settings({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();

  return (
    <SplitCrudPage
      title={t("settings.title", "System Settings")}
      table="settings"
      columns={COLUMNS}
      defaultValues={DEFAULTS}
      renderBody={renderBody}
      activeNav={activeNav}
      onNavigate={onNavigate}
      selectRecordOid={selectRecordOid}
      selectSeq={selectSeq}
    />
  );
}
