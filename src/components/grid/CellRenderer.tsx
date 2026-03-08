"use client";

import type { ColumnDef } from "@/platform/core/ColumnDef";
import type { Row } from "@/platform/core/types";

interface CellRendererProps {
  col: ColumnDef;
  row: Row;
}

export function CellRenderer({ col, row }: CellRendererProps) {
  const val = row[col.key];

  switch (col.renderer) {

    case "boolean":
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, borderRadius: 3,
          background: val ? "var(--accent, #0e86ca)" : "transparent",
          border: `1.5px solid ${val ? "var(--accent, #0e86ca)" : "var(--border)"}`,
          color: "var(--accent-text)", fontSize: "0.65rem", fontWeight: 700,
        }}>
          {val ? "✓" : ""}
        </span>
      );

    case "dateDisplay": {
      if (!val) return <span style={{ color: "var(--text-muted)" }}>—</span>;
      const d = new Date(val as string);
      return <span>{d.toLocaleDateString()}</span>;
    }

    case "number":
      if (val === null || val === undefined) return <span style={{ color: "var(--text-muted)" }}>—</span>;
      return <span>{Number(val).toLocaleString()}</span>;

    case "currency": {
      if (val === null || val === undefined) return <span style={{ color: "var(--text-muted)" }}>—</span>;
      const prec = col.precision ?? 2;
      return <span>{Number(val).toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}</span>;
    }

    case "badge": {
      if (val === null || val === undefined) return null;
      const opts = col.rendererOptions ?? {};
      const label  = opts.labels?.[String(val)]  ?? String(val);
      const color  = opts.colors?.[String(val)]  ?? "var(--accent, #0e86ca)";
      const bg     = opts.bgs?.[String(val)]     ?? `${color}22`;
      return (
        <span style={{
          display: "inline-block", padding: "1px 8px",
          borderRadius: 10, fontSize: "0.72rem", fontWeight: 600,
          background: bg, color,
          border: `1px solid ${color}55`,
          whiteSpace: "nowrap",
        }}>
          {label}
        </span>
      );
    }

    case "svg": {
      if (!val) return <span style={{ color: "var(--text-muted)" }}>—</span>;
      return (
        <span
          dangerouslySetInnerHTML={{ __html: String(val) }}
          style={{ display: "inline-flex", width: 32, height: 22, alignItems: "center", justifyContent: "center" }}
        />
      );
    }

    case "password":
      return <span style={{ letterSpacing: 2, color: "var(--text-muted)" }}>••••••••</span>;

    case "text":
    default:
      if (val === null || val === undefined) return <span style={{ color: "var(--text-muted)" }}>—</span>;
      return <span>{String(val)}</span>;
  }
}
