"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import type { SectionDef } from "@/platform/core/SectionDef";
import type { FieldDef } from "@/platform/core/FieldDef";
import { FieldRenderer } from "./FieldRenderer";

type DesignTarget = {
  type: "tab" | "section" | "field";
  key: string;
  parentKey?: string;
};

interface SectionRendererProps {
  section: SectionDef;
  designMode?: boolean;
  selectedTarget?: DesignTarget | null;
  onSelectTarget?: (target: DesignTarget | null) => void;
}

export function SectionRenderer({ section, designMode = false, selectedTarget = null, onSelectTarget }: SectionRendererProps) {
  const isMobile = useIsMobile();
  if (section.hidden) return null;

  const fields = section.children.filter(c => c.type === "field") as FieldDef[];
  const columnCount = isMobile ? 1 : section.columns;
  const isSelected = designMode && selectedTarget?.type === "section" && selectedTarget.key === section.key;

  return (
    <div
      onClick={designMode ? (e => { e.stopPropagation(); onSelectTarget?.({ type: "section", key: section.key, parentKey: (section as any).panel?.activeTabKey }); }) : undefined}
      style={{ marginBottom: "1.25rem", border: designMode ? (isSelected ? "2px solid rgba(245, 158, 11, 0.8)" : "1px dashed rgba(245, 158, 11, 0.45)") : undefined, borderRadius: designMode ? 8 : undefined, padding: designMode ? "0.75rem" : undefined, cursor: designMode ? "pointer" : undefined }}
    >
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
            designMode={designMode}
            selected={designMode && selectedTarget?.type === "field" && selectedTarget.key === field.key}
            onSelect={() => onSelectTarget?.({ type: "field", key: field.key, parentKey: section.key })}
          />
        ))}
      </div>
    </div>
  );
}
