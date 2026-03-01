"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";
import { Badge } from "@/components/ui";

// ── Types ──────────────────────────────────────────────────────

type AuditEntry = {
  id: number;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_by_name: string;
  changed_at: string;
};

type AuditGroup = {
  timestamp: string;
  changed_by: string;
  changed_by_name: string;
  action: string;
  changes: AuditEntry[];
};

interface AuditPanelProps {
  /** The database table being audited (e.g. "users", "pasoe_brokers") */
  table: string;
  /** The oid UUID of the record to show history for */
  recordOid: string;
  /** Whether the panel is open */
  open: boolean;
  /** Called when the panel should close */
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit",
    hour12: true,
  });
}

function fmtFieldName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function truncate(val: string | null, max = 80): string {
  if (!val) return "(empty)";
  return val.length > max ? val.slice(0, max) + "…" : val;
}

function actionBadge(action: string) {
  switch (action.toUpperCase()) {
    case "INSERT": return <Badge variant="success">Created</Badge>;
    case "DELETE": return <Badge variant="danger">Deleted</Badge>;
    case "UPDATE": return <Badge variant="warning">Updated</Badge>;
    default:       return <Badge variant="neutral">{action}</Badge>;
  }
}

/** Group consecutive entries by same timestamp + user + action */
function groupEntries(entries: AuditEntry[]): AuditGroup[] {
  const groups: AuditGroup[] = [];
  for (const e of entries) {
    const ts = e.changed_at;
    const last = groups[groups.length - 1];
    if (last && last.timestamp === ts && last.changed_by === e.changed_by && last.action === e.action) {
      last.changes.push(e);
    } else {
      groups.push({
        timestamp: ts,
        changed_by: e.changed_by,
        changed_by_name: e.changed_by_name,
        action: e.action,
        changes: [e],
      });
    }
  }
  return groups;
}

// ── Component ──────────────────────────────────────────────────

export function AuditPanel({ table, recordOid, open, onClose }: AuditPanelProps) {
  const t = useT();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAudit = useCallback(async () => {
    if (!table || !recordOid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/audit-log?table=${encodeURIComponent(table)}&oid=${encodeURIComponent(recordOid)}&limit=200`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("audit.failed_load", "Failed to load audit history"));
        setEntries([]);
        setTotal(0);
      } else {
        const data = await res.json();
        setEntries(data.rows || []);
        setTotal(data.total || 0);
      }
    } catch {
      setError("Network error loading audit history");
    }
    setLoading(false);
  }, [table, recordOid]);

  useEffect(() => {
    if (open) fetchAudit();
  }, [open, fetchAudit]);

  if (!open) return null;

  const groups = groupEntries(entries);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 998,
          background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)",
        }}
      />

      {/* Slide-in panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(480px, 100vw)", zIndex: 999,
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column",
          animation: "slideInRight 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface-alt)" }}
        >
          <span style={{ color: "var(--text-secondary)" }}><Icon name="shield" size={18} /></span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Audit Trail
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {total} {total === 1 ? "entry" : "entries"} · {table}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12" style={{ color: "var(--text-muted)" }}>
              <span className="text-sm">Loading audit history...</span>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
              {error}
            </div>
          )}

          {!loading && !error && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--text-muted)" }}>
              <Icon name="clock" size={36} className="mb-3 opacity-30" />
              <p className="text-sm">No audit history yet</p>
              <p className="text-xs mt-1">Changes will appear here after updates.</p>
            </div>
          )}

          {!loading && !error && groups.length > 0 && (
            <div className="space-y-4">
              {groups.map((group, gi) => (
                <div key={gi} className="relative">
                  {/* Timeline connector */}
                  {gi < groups.length - 1 && (
                    <div style={{
                      position: "absolute", left: 11, top: 28, bottom: -16, width: 2,
                      background: "var(--border-light)",
                    }} />
                  )}

                  <div className="flex gap-3">
                    {/* Timeline dot */}
                    <div className="flex-shrink-0 mt-1">
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: group.action.toUpperCase() === "INSERT" ? "rgba(34,197,94,0.15)"
                          : group.action.toUpperCase() === "DELETE" ? "rgba(239,68,68,0.15)"
                          : "rgba(59,130,246,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{
                            color: group.action.toUpperCase() === "INSERT" ? "rgb(34,197,94)"
                              : group.action.toUpperCase() === "DELETE" ? "rgb(239,68,68)"
                              : "rgb(59,130,246)",
                          }}>
                          <Icon
                            name={group.action.toUpperCase() === "INSERT" ? "plus"
                              : group.action.toUpperCase() === "DELETE" ? "trash"
                              : "save"}
                            size={12}
                          />
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {actionBadge(group.action)}
                        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {group.changed_by_name || group.changed_by || "system"}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {fmtTimestamp(group.timestamp)}
                        </span>
                      </div>

                      {/* Field changes for UPDATE */}
                      {group.action.toUpperCase() === "UPDATE" && group.changes.some(c => c.field_name) && (
                        <div
                          className="rounded-lg overflow-hidden mt-2"
                          style={{ border: "1px solid var(--border-light)" }}
                        >
                          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ background: "var(--bg-surface-alt)" }}>
                                <th className="text-left px-3 py-1.5 font-medium" style={{ color: "var(--text-muted)", width: "30%" }}>Field</th>
                                <th className="text-left px-3 py-1.5 font-medium" style={{ color: "var(--text-muted)", width: "35%" }}>Before</th>
                                <th className="text-left px-3 py-1.5 font-medium" style={{ color: "var(--text-muted)", width: "35%" }}>After</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.changes.filter(c => c.field_name).map((c, ci) => (
                                <tr key={ci} style={{ borderTop: ci > 0 ? "1px solid var(--border-light)" : undefined }}>
                                  <td className="px-3 py-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                                    {fmtFieldName(c.field_name!)}
                                  </td>
                                  <td className="px-3 py-1.5" style={{ color: "var(--danger-text)" }}>
                                    {truncate(c.old_value)}
                                  </td>
                                  <td className="px-3 py-1.5" style={{ color: "rgb(34,197,94)" }}>
                                    {truncate(c.new_value)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* No field detail (INSERT/DELETE or touch-only) */}
                      {(group.action.toUpperCase() !== "UPDATE" || !group.changes.some(c => c.field_name)) && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {group.action.toUpperCase() === "INSERT" ? t("audit.record_created", "Record created") :
                           group.action.toUpperCase() === "DELETE" ? t("audit.record_deleted", "Record deleted") :
                           "Record touched (no field changes)"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slide-in animation */}
      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
