"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import type { Row } from "@/platform/core/types";

interface KeyPanelProps {
  panel: any;
  currentRecord: Row | null;
  isNew: boolean;
}

export function KeyPanel({ panel, currentRecord, isNew }: KeyPanelProps) {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  if (!currentRecord && !isNew) return null;

  const keyFields = ((panel.fields as any[]) ?? []).filter((f: any) => f.keyField);
  if (!keyFields.length) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "2rem",
      padding: "0.5rem 1.25rem",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-surface)",
      flexShrink: 0,
      minHeight: 44,
    }}>
      {keyFields.map((field: any) => {
        const value = currentRecord?.[field.key];
        const display = value != null && value !== "" ? String(value) : (isNew ? "New" : "---");
        return (
          <div key={field.key} style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
            }}>
              {field.getLabel() || field.key}
            </span>
            <span style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: isNew ? "var(--text-muted)" : "var(--text-primary)",
              fontStyle: isNew ? "italic" : "normal",
            }}>
              {display}
            </span>
          </div>
        );
      })}
    </div>
  );
}
