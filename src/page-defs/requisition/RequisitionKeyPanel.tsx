"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import type { Row } from "@/platform/core/types";

interface RequisitionKeyPanelProps {
  currentRecord: Row | null;
  isNew: boolean;
}

export function RequisitionKeyPanel({ currentRecord, isNew }: RequisitionKeyPanelProps) {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  if (!currentRecord && !isNew) return null;

  const reqNumber   = (currentRecord?.req_number   as string) || "";
  const description = (currentRecord?.description  as string) || (isNew ? resolveClientText(tx("requisition.key_panel.new_req", "New Requisition")) : "");
  const reqType     = (currentRecord?.req_type     as string) || "";
  const status      = String(currentRecord?.status ?? "").toUpperCase();
  const totalAmount = typeof currentRecord?.total_amount === "number" ? currentRecord.total_amount : 0;
  const isUrgent    = currentRecord?.is_urgent === true || currentRecord?.is_urgent === 1;

  const statusColor = status === "APPROVED"
    ? { bg: "rgba(34,197,94,0.15)", text: "rgb(22,163,74)" }
    : status === "CONFIRMED"
      ? { bg: "rgba(234,179,8,0.15)", text: "rgb(161,98,7)" }
      : { bg: "rgba(156,163,175,0.15)", text: "rgb(107,114,128)" };

  const statusLabel = status === "APPROVED"
    ? resolveClientText(tx("requisition.status.approved", "Approved"))
    : status === "CONFIRMED"
      ? resolveClientText(tx("requisition.status.pending", "Pending"))
      : resolveClientText(tx("requisition.status.draft", "Draft"));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
      {/* Req Number Badge */}
      <div style={{
        width: 72, height: 72, borderRadius: 10, flexShrink: 0,
        background: "var(--accent-light, #dbeafe)",
        border: "2px solid var(--accent, #2563eb)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--accent, #2563eb)", opacity: 0.8 }}>REQ</span>
        <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent, #2563eb)" }}>
          {isNew ? "NEW" : reqNumber.slice(-6)}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: isNew ? "var(--text-muted)" : "var(--text-primary)", fontStyle: isNew ? "italic" : "normal" }}>
            {description || "—"}
          </span>
          {!isNew && (
            <span style={{
              fontSize: "0.72rem", fontWeight: 600, padding: "2px 10px", borderRadius: 999,
              background: statusColor.bg, color: statusColor.text,
            }}>
              {statusLabel}
            </span>
          )}
          {isUrgent && !isNew && (
            <span style={{
              fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: "rgba(239,68,68,0.15)", color: "rgb(220,38,38)",
            }}>
              {resolveClientText(tx("requisition.status.urgent", "URGENT"))}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
          {reqNumber && <Chip label={resolveClientText(tx("requisition.key_panel.number", "Number"))} value={reqNumber} />}
          {reqType   && <Chip label={resolveClientText(tx("requisition.key_panel.type", "Type"))} value={reqType} />}
          {!isNew    && <Chip label={resolveClientText(tx("requisition.key_panel.total", "Total"))} value={`$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
      <span style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
