"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { LeafNode, SplitNode } from "@/platform/core/LayoutNode";
import { useIsMobile } from "@/hooks/useIsMobile";

type LayoutChild = LeafNode | SplitNode;

interface LayoutRendererProps {
  node: LayoutChild;
}

/** Walks a SplitNode / LeafNode tree and renders it with draggable dividers. */
export function LayoutRenderer({ node }: LayoutRendererProps) {
  if (node instanceof LeafNode) {
    return (
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        {node.show()}
      </div>
    );
  }
  return <SplitRenderer node={node} />;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Walk a layout subtree and return the first LeafNode content that has onDisplay. */
function findPanelContent(node: LeafNode | SplitNode): any | null {
  if (node instanceof LeafNode) {
    return node.content && "onDisplay" in node.content ? node.content : null;
  }
  return findPanelContent(node.children[0]) ?? findPanelContent(node.children[1]);
}

// ─── SplitRenderer ────────────────────────────────────────────────────────────

const DIVIDER_PX = 5;

function SplitRenderer({ node }: { node: SplitNode }) {
  const isMobile = useIsMobile();

  return isMobile
    ? <MobileSplitRenderer node={node} />
    : <DesktopSplitRenderer node={node} />;
}

// ─── Mobile: one pane at a time ───────────────────────────────────────────────

function MobileSplitRenderer({ node }: { node: SplitNode }) {
  const [activePane, setActivePane] = useState(0);

  // Switch to the detail pane whenever the secondary panel displays a record.
  useEffect(() => {
    const panel = findPanelContent(node.children[1]);
    if (!panel) return;

    const handleDisplay = (row: any) => {
      if (row) setActivePane(1);
    };
    panel.addDisplayListener(handleDisplay);
    return () => {
      panel.removeDisplayListener(handleDisplay);
    };
  }, [node]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {activePane === 1 && (
        <button
          onClick={() => setActivePane(0)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", flexShrink: 0,
            background: "var(--bg-surface-alt)", border: "none",
            borderBottom: "1px solid var(--border)",
            color: "var(--accent)", fontSize: "0.875rem",
            cursor: "pointer", textAlign: "left",
          }}
        >
          ← Back
        </button>
      )}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <LayoutRenderer node={node.children[activePane]} />
      </div>
    </div>
  );
}

// ─── Desktop: draggable split ─────────────────────────────────────────────────

function DesktopSplitRenderer({ node }: { node: SplitNode }) {
  const [sizes, setSizes] = useState<[number, number]>(node.sizes);
  const containerRef      = useRef<HTMLDivElement>(null);
  const dragging          = useRef(false);
  const isHoriz           = node.direction === "horizontal";
  const [minA, minB]      = node.minSizes;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect   = containerRef.current.getBoundingClientRect();
      const total  = isHoriz ? rect.width  : rect.height;
      const offset = isHoriz ? ev.clientX - rect.left : ev.clientY - rect.top;
      const pctA   = Math.max(
        (minA / total) * 100,
        Math.min((offset / total) * 100, 100 - (minB / total) * 100),
      );
      setSizes([pctA, 100 - pctA]);
    };

    const onUp = (ev: MouseEvent) => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      if (containerRef.current) {
        const rect   = containerRef.current.getBoundingClientRect();
        const total  = isHoriz ? rect.width  : rect.height;
        const offset = isHoriz ? ev.clientX - rect.left : ev.clientY - rect.top;
        const pctA   = Math.max(
          (minA / total) * 100,
          Math.min((offset / total) * 100, 100 - (minB / total) * 100),
        );
        node.onChange?.([pctA, 100 - pctA]);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [isHoriz, minA, minB, node]);

  const [sizeA, sizeB] = sizes;

  const paneA: React.CSSProperties = isHoriz
    ? { width: `${sizeA}%`, height: "100%", overflow: "hidden", flexShrink: 0 }
    : { height: `${sizeA}%`, width: "100%", overflow: "hidden", flexShrink: 0 };

  const paneB: React.CSSProperties = isHoriz
    ? { width: `${sizeB}%`, height: "100%", overflow: "hidden", flexShrink: 0 }
    : { height: `${sizeB}%`, width: "100%", overflow: "hidden", flexShrink: 0 };

  const divider: React.CSSProperties = isHoriz
    ? { width: DIVIDER_PX,  height: "100%", flexShrink: 0, cursor: "col-resize",
        background: "var(--border, #e0e0e0)", userSelect: "none", transition: "background 0.15s" }
    : { height: DIVIDER_PX, width:  "100%", flexShrink: 0, cursor: "row-resize",
        background: "var(--border, #e0e0e0)", userSelect: "none", transition: "background 0.15s" };

  return (
    <div
      ref={containerRef}
      style={{ display: "flex", flexDirection: isHoriz ? "row" : "column",
               width: "100%", height: "100%", overflow: "hidden" }}
    >
      <div style={paneA}>
        <LayoutRenderer node={node.children[0]} />
      </div>

      <div
        style={divider}
        onMouseDown={onMouseDown}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--accent, #0e86ca)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--border, #e0e0e0)")}
      />

      <div style={paneB}>
        <LayoutRenderer node={node.children[1]} />
      </div>
    </div>
  );
}
