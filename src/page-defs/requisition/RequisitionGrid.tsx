import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import { DataGridDef } from "@/platform/core/DataGridDef";
import type { Row } from "@/platform/core/types";
import { RequisitionDataSource } from "./RequisitionDataSource";

export class RequisitionGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "requisition", pageSize: 0 }, form);
    this.dataSource = new RequisitionDataSource();
  }

  async loadColumns() {
    await super.loadColumns();

    // Hide columns we don't want in the grid but need for the panel
    this.getColumn("justification_note")?.applyOptions({ hidden: true });
    this.getColumn("submitted_by")?.applyOptions({ hidden: true });
    this.getColumn("submitted_at")?.applyOptions({ hidden: true });
    this.getColumn("approved_by")?.applyOptions({ hidden: true });
    this.getColumn("approved_at")?.applyOptions({ hidden: true });
    this.getColumn("is_change_order")?.applyOptions({ hidden: true });
    this.getColumn("created_by")?.applyOptions({ hidden: true });
    this.getColumn("vendor_code")?.applyOptions({ hidden: true });
    this.getColumn("buyer")?.applyOptions({ hidden: true });
  }

  renderCard(row: Row, isSelected: boolean) {
    const status = String(row.status ?? "").toUpperCase();
    const isUrgent = row.is_urgent === true || row.is_urgent === 1 || row.is_urgent === "true";

    const statusColor = status === "APPROVED"
      ? { bg: "rgba(34,197,94,0.12)", text: "rgb(22,163,74)" }
      : status === "CONFIRMED"
        ? { bg: "rgba(234,179,8,0.12)", text: "rgb(161,98,7)" }
        : { bg: "rgba(156,163,175,0.12)", text: "rgb(107,114,128)" };

    const statusLabel = status === "APPROVED"
      ? resolveClientText(tx("requisition.status.approved", "Approved"))
      : status === "CONFIRMED"
        ? resolveClientText(tx("requisition.status.pending", "Pending"))
        : resolveClientText(tx("requisition.status.draft", "Draft"));

    const amount = typeof row.total_amount === "number"
      ? row.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "0.00";

    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px",
        borderBottom: "1px solid var(--border-light, var(--border))",
        background: isSelected ? "var(--bg-selected, rgba(14,134,202,0.08))" : "transparent",
        cursor: "pointer",
      }}>
        {/* Req number badge */}
        <div style={{
          width: 56, height: 56, borderRadius: 8, flexShrink: 0,
          background: isSelected ? "var(--accent)" : "var(--bg-surface-alt)",
          border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          fontSize: "0.7rem", fontWeight: 600,
          color: isSelected ? "#fff" : "var(--text-secondary)",
        }}>
          <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>REQ</span>
          <span style={{ fontSize: "0.8rem" }}>{String(row.req_number ?? "").slice(-6)}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {(row.description as string) || (row.req_number as string)}
            </span>
            {isUrgent && (
              <span style={{
                fontSize: "0.6rem", fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                background: "rgba(239,68,68,0.12)", color: "rgb(220,38,38)",
              }}>
                {resolveClientText(tx("requisition.status.urgent", "URGENT"))}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.req_type as string}{row.created_by_name ? ` · ${row.created_by_name}` : ""}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
            ${amount}
          </div>
          <div style={{
            fontSize: "0.65rem", fontWeight: 600, padding: "2px 7px", borderRadius: 10, marginTop: 4,
            background: statusColor.bg,
            color: statusColor.text,
            display: "inline-block",
          }}>
            {statusLabel}
          </div>
        </div>
      </div>
    );
  }
}
