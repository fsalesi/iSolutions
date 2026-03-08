// ═══════════════════════════════════════════════════════════════════════════════
// DrawerRenderer.tsx — Renders the Panel Stack as Slide-In Overlays
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import { useEffect, useCallback } from "react";
import { useDrawer } from "@/context/DrawerContext";
import { EditPanelRenderer } from "@/components/panel/EditPanelRenderer";
import { Icon } from "@/components/icons/Icon";

export function DrawerRenderer() {
  const { stack, pop, clear } = useDrawer();

  // Escape key closes top panel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && stack.length > 0) {
      e.preventDefault();
      pop();
    }
  }, [stack.length, pop]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (stack.length === 0) return null;

  return (
    <>
      {/* Backdrop — clicking closes ALL panels */}
      <div
        onClick={clear}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.3)",
          zIndex: 100,
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Render each panel in the stack */}
      {stack.map((entry, idx) => (
        <SlideInPanel
          key={entry.id}
          panel={entry.panel}
          index={idx}
          total={stack.length}
          onClose={pop}
        />
      ))}
    </>
  );
}

interface SlideInPanelProps {
  panel: any;
  index: number;
  total: number;
  onClose: () => void;
}

function SlideInPanel({ panel, index, total, onClose }: SlideInPanelProps) {
  const zIndex = 110 + index * 10;
  const isTopPanel = index === total - 1;
  const offsetRight = (total - 1 - index) * 8;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: offsetRight,
        bottom: 0,
        width: "min(600px, 90vw)",
        background: "var(--bg-surface)",
        boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.15)",
        zIndex,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transform: isTopPanel ? "none" : `scale(${1 - (total - 1 - index) * 0.02})`,
        transformOrigin: "right center",
        transition: "transform 0.2s ease, right 0.2s ease",
      }}
    >
      {/* Header with close button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface-alt)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>
          {panel.title || "Details"}
        </span>
        <button
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
          title="Close (Esc)"
        >
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <EditPanelRenderer panel={panel} />
      </div>
    </div>
  );
}
