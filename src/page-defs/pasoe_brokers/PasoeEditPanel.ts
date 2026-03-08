import { EditPanel } from "@/platform/core/EditPanel";
import { TabDef }    from "@/platform/core/TabDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { FieldDef }  from "@/platform/core/FieldDef";
import { DomainLookup } from "@/components/lookup/presets/DomainLookup";

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
      label:          "Test Connection",
      requiresRecord: true,
      onClick: async () => {
        const record = this.toolbar.panel?.currentRecord;
        const domain = record?.domain as string | undefined;
        const name   = record?.name   as string | undefined;
        if (!domain || !name) { alert("No broker record selected."); return; }

        const btn = this.toolbar.getButton("test_connection");
        btn.disabled = true;
        btn.label    = "Testing…";
        this.toolbar.refresh();

        try {
          const res  = await fetch("/api/pasoe_brokers/test-connection", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ domain, name }),
          });
          const data = await res.json();
          alert(data.ok ? `✅ ${data.message}` : `❌ ${data.message}`);
        } catch (e) {
          alert(`❌ Request failed: ${e}`);
        } finally {
          btn.disabled = false;
          btn.label    = "Test Connection";
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
              new FieldDef({ key: "name",     label: "Broker Name", keyField: true, required: true }),
              new FieldDef({ key: "domain",   label: "Domain",      required: true, renderer: "lookup", lookupConfig: DomainLookup() }),
              new FieldDef({ key: "cacheable", label: "Cacheable",  renderer: "checkbox" }),
            ],
          }),
          new SectionDef({
            key:      "connection",
            label:    "Connection",
            columns:  1,
            children: [
              new FieldDef({ key: "connect_string", label: "Connect String", required: true }),
              new FieldDef({ key: "proxy_connect",  label: "Proxy Connect" }),
            ],
          }),
        ],
      }),

    ];
  }
}
