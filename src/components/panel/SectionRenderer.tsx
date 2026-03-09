"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import type { SectionDef } from "@/platform/core/SectionDef";
import type { FieldDef } from "@/platform/core/FieldDef";
import { FieldRenderer } from "./FieldRenderer";

interface SectionRendererProps {
  section: SectionDef;
}

export function SectionRenderer({ section }: SectionRendererProps) {
  const isMobile = useIsMobile();
  if (section.hidden) return null;

  const fields = section.children.filter(c => c.type === "field") as FieldDef[];
  const columnCount = isMobile ? 1 : section.columns;

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      {!section.hideLabel && section.getLabel() && (
        <h3 style={{
          fontSize: "0.7rem", fontWeight: 600, color: "var(--section-title, var(--text-muted))",
          textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: "0.75rem",
        }}>
          {section.getLabel()}
        </h3>
      )}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columnCount}, 1fr)`, gap: "0.75rem" }}>
        {fields.map(field => (
          <FieldRenderer
            key={field.key}
            field={field}
          />
        ))}
      </div>
    </div>
  );
}
