"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";
import { Panel, type PanelProps } from "./Panel";

// ── Constants ──
const DEFAULT_GRID_PCT = 30;
const MIN_GRID_PCT = 15;
const MAX_GRID_PCT = 75;

// ── localStorage helpers ──
function getSavedPct(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(`split-${key}`);
    if (v) { const n = parseFloat(v); if (n >= MIN_GRID_PCT && n <= MAX_GRID_PCT) return n; }
  } catch {}
  return null;
}

function savePct(key: string, pct: number) {
  try { localStorage.setItem(`split-${key}`, String(Math.round(pct * 10) / 10)); } catch {}
}

function clearPct(key: string) {
  try { localStorage.removeItem(`split-${key}`); } catch {}
}

// ── Splitter handle ──
function SplitHandle({ onMouseDown, onReset }: {
  onMouseDown: (e: React.MouseEvent) => void;
  onReset: () => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => { e.preventDefault(); onReset(); }}
      className="flex-shrink-0 flex items-center justify-center"
      title="Drag to resize · Double-click to reset"
      style={{
        width: 7,
        cursor: "col-resize",
        background: "var(--border-light)",
        transition: "background 0.15s",
        zIndex: 5,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.opacity = "0.6"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--border-light)"; e.currentTarget.style.opacity = "1"; }}
    >
      <div style={{ width: 3, height: 32, borderRadius: 2, background: "var(--text-muted)", opacity: 0.35 }} />
    </div>
  );
}

// ── SplitPanel ──

export interface SplitPanelProps extends Omit<PanelProps, "children"> {
  /** Key for localStorage persistence of splitter position */
  storageKey: string;
  /** Left slot content */
  left: ReactNode;
  /** Right slot content */
  right: ReactNode;
  /** Default left-slot width as percentage (default 30) */
  defaultPct?: number;
  /** Is right slot visible? When false, left takes full width */
  expanded?: boolean;
}

/**
 * SplitPanel — extends Panel with a draggable vertical splitter between two children.
 *
 * Doesn't know or care what its children are. Just splits them.
 */
export function SplitPanel({
  storageKey,
  left,
  right,
  defaultPct = DEFAULT_GRID_PCT,
  expanded = true,
  className,
  style,
}: SplitPanelProps) {
  const saved = getSavedPct(storageKey);
  const [gridPct, setGridPct] = useState<number>(saved ?? defaultPct);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(MIN_GRID_PCT, Math.min(MAX_GRID_PCT, pct));
      setGridPct(clamped);
      savePct(storageKey, clamped);
    };
    const handleUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [storageKey]);

  const resetToDefault = useCallback(() => {
    setGridPct(defaultPct);
    clearPct(storageKey);
  }, [storageKey, defaultPct]);

  return (
    <Panel
      className={className}
      style={{ display: "flex", flexDirection: "row", height: "100%", overflow: "hidden", ...style }}
    >
      <div ref={containerRef} style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* Left slot */}
        <div style={{
          ...(expanded ? { width: `${gridPct}%` } : { width: "100%" }),
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          {left}
        </div>

        {/* Splitter handle (only when right is visible) */}
        {expanded && <SplitHandle onMouseDown={onMouseDown} onReset={resetToDefault} />}

        {/* Right slot */}
        {expanded && (
          <div style={{
            flex: 1,
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}>
            {right}
          </div>
        )}
      </div>
    </Panel>
  );
}
