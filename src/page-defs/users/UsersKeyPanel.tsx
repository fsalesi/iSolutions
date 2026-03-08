"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import type { Row } from "@/platform/core/types";

interface UsersKeyPanelProps {
  currentRecord: Row | null;
  isNew: boolean;
}

export function UsersKeyPanel({ currentRecord, isNew }: UsersKeyPanelProps) {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  if (!currentRecord && !isNew) return null;

  const photoUrl = currentRecord?.photo as string | null;
  const fullName = (currentRecord?.full_name as string) || (isNew ? resolveClientText(tx("users.key_panel.new_user", "New User")) : "");
  const userId   = (currentRecord?.user_id  as string) || "";
  const title    = (currentRecord?.title    as string) || "";
  const company  = (currentRecord?.company  as string) || "";
  const isActive = (currentRecord?.is_active as boolean) ?? true;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
      <div style={{ width: 96, height: 96, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "var(--bg-muted, #e5e7eb)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {photoUrl ? (
          <img src={photoUrl} alt={fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: "2.25rem", fontWeight: 700, color: "var(--text-muted)", userSelect: "none" }}>
            {fullName ? fullName.charAt(0).toUpperCase() : "?"}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: isNew ? "var(--text-muted)" : "var(--text-primary)", fontStyle: isNew ? "italic" : "normal" }}>
            {fullName || "—"}
          </span>
          {!isNew && (
            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: isActive ? "var(--accent-light, #dbeafe)" : "var(--bg-muted, #f3f4f6)", color: isActive ? "var(--accent, #2563eb)" : "var(--text-muted)" }}>
              {isActive
                ? resolveClientText(tx("users.status.active", "Active"))
                : resolveClientText(tx("users.status.inactive", "Inactive"))}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
          {userId && <Chip label={resolveClientText(tx("users.key_panel.id", "ID"))} value={userId} />}
          {title   && <Chip label={resolveClientText(tx("users.key_panel.title", "Title"))} value={title} />}
          {company && <Chip label={resolveClientText(tx("users.key_panel.company", "Company"))} value={company} />}
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
