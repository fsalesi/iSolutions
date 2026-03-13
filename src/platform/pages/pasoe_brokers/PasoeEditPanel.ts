import { EditPanel } from "@/platform/core/EditPanel";
import { TabDef }    from "@/platform/core/TabDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { FieldDef }  from "@/platform/core/FieldDef";
import { DomainLookup } from "@/components/lookup/presets/DomainLookup";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";

/**
 * PasoeEditPanel — Edit panel for PASOE Brokers.
 *
 * Tab: Details
 *   Section: Broker
 *     name           (key field)
 *     domain         (lookup)
 *     cacheable      (checkbox)
 *   Section: Connection
 *     connect_string
 *     proxy_connect
 */
export class PasoeEditPanel extends EditPanel {
  constructor(form?: any) {
    super({ useNotes: true, useAudit: true }, form);

    this.toolbar.addButton({
      key:            "test_connection",
      label:          tx("pasoe_brokers.actions.test_connection", "Test Connection"),
      requiresRecord: true,
      onClick: async () => {
        const record = this.toolbar.panel?.currentRecord;
        const domain = record?.domain as string | undefined;
        const name   = record?.name   as string | undefined;
        if (!domain || !name) { await this.form?.alertDialog.error(resolveClientText(tx("pasoe_brokers.messages.no_record_selected", "No broker record selected."))); return; }

        const btn = this.toolbar.getButton("test_connection");
        btn.disabled = true;
        btn.label    = tx("pasoe_brokers.actions.testing", "Testing...");
        this.toolbar.refresh();

        try {
          const res  = await fetch("/api/pasoe_brokers/test-connection", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ domain, name }),
          });
          const data = await res.json();
          if (data.ok) await this.form?.alertDialog.info(data.message, resolveClientText(tx("pasoe_brokers.messages.test_title", "Broker Test")));
          else await this.form?.alertDialog.error(data.message, resolveClientText(tx("pasoe_brokers.messages.test_failed_title", "Broker Test Failed")));
        } catch (e) {
          await this.form?.alertDialog.error(resolveClientText(tx("pasoe_brokers.messages.request_failed", "Request failed: {error}"), { error: String(e) }), resolveClientText(tx("pasoe_brokers.messages.test_failed_title", "Broker Test Failed")));
        } finally {
          btn.disabled = false;
          btn.label    = tx("pasoe_brokers.actions.test_connection", "Test Connection");
          this.toolbar.refresh();
        }
      },
    });

    this.tabs = [

      new TabDef({
        key:   "details",
        label: "Details",
        children: [
          new SectionDef({
            key:      "broker",
            label:    "Broker",
            columns:  2,
            children: [
              new FieldDef({ key: "name",     keyField: true, required: true }),
              new FieldDef({ key: "domain",   required: true, renderer: "lookup", lookupConfig: DomainLookup() }),
              new FieldDef({ key: "cacheable", renderer: "boolean" }),
            ],
          }),
          new SectionDef({
            key:      "connection",
            label:    "Connection",
            columns:  1,
            children: [
              new FieldDef({ key: "connect_string", required: true }),
              new FieldDef({ key: "proxy_connect" }),
            ],
          }),
        ],
      }),

    ];
  }
}
