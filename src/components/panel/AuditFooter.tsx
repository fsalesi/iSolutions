"use client";

import { useT } from "@/context/TranslationContext";

function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

/**
 * AuditFooter — displays created/updated timestamps at the bottom of a CrudPanel.
 */
export function AuditFooter({ row, onAuditClick }: {
  row: Record<string, any>;
  onAuditClick?: () => void;
}) {
  const t = useT();
  const created = fmtStamp(row.created_at);
  const updated = fmtStamp(row.updated_at);
  const createdBy = row.created_by || "";
  const updatedBy = row.updated_by || "";

  if (!created && !updated) return null;

  return (
    <div
      className="flex items-center gap-x-4 gap-y-0.5 flex-wrap px-4 sm:px-5 py-2 text-[11px] flex-shrink-0"
      style={{ borderTop: "1px solid var(--border-light)", color: "var(--text-muted)" }}
    >
      {created && (
        <span>
          {t("crud.created", "Created")} {created}{createdBy ? ` by ${createdBy}` : ""}
        </span>
      )}
      {updated && (
        <span>
          {t("crud.updated", "Updated")} {updated}{updatedBy ? ` by ${updatedBy}` : ""}
          {onAuditClick && (
            <button
              onClick={onAuditClick}
              className="ml-1.5 underline transition-colors"
              style={{ color: "var(--accent)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--accent)"; }}
            >
              {t("crud.view_history", "View history")}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
