"use client";
/**
 * SlidePanel — right-edge overlay drawer.
 * Auto-sizes width to fit toolbar content (never clips buttons).
 * Falls back to minWidth when content is narrower.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

interface TabDef { key: string; label: string; }

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Minimum panel width (default 480). Panel grows beyond this to fit toolbar. */
  minWidth?: number;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional tab bar rendered between header and body */
  tabs?: TabDef[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
}

export function SlidePanel({ open, onClose, title, minWidth = 480, children, footer, tabs, activeTab, onTabChange }: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Measure natural (unwrapped) toolbar width after content renders
  useEffect(() => {
    if (!open || !panelRef.current) { setContentWidth(0); return; }

    const measure = () => {
      const panel = panelRef.current;
      if (!panel) return;
      // Find any flex-wrap toolbar and temporarily unwrap to measure
      const toolbars = panel.querySelectorAll<HTMLElement>(".flex-wrap");
      let maxW = 0;
      toolbars.forEach(tb => {
        const orig = tb.style.flexWrap;
        tb.style.flexWrap = "nowrap";
        maxW = Math.max(maxW, tb.scrollWidth);
        tb.style.flexWrap = orig;
      });
      setContentWidth(maxW);
    };

    // Measure after paint
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const resolvedWidth = Math.min(
    Math.max(minWidth, contentWidth + 40), // +40 for panel chrome (padding/border)
    typeof window !== "undefined" ? window.innerWidth * 0.9 : 900
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.35)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 51,
          width: resolvedWidth,
          maxWidth: "90vw",
          background: "var(--bg-body)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 250ms cubic-bezier(0.4,0,0.2,1), width 200ms ease",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title || "Edit"}
          </h3>
          <button
            onClick={onClose}
            className="text-lg"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        {tabs && tabs.length > 0 && (
          <div
            className="flex overflow-x-auto flex-shrink-0 px-2"
            style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}
          >
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => onTabChange?.(tab.key)}
                className="flex items-center px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  borderBottom: `2px solid ${activeTab === tab.key ? "var(--accent)" : "transparent"}`,
                  color: activeTab === tab.key ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: "12px 20px", borderTop: "1px solid var(--border)",
            display: "flex", gap: 8, justifyContent: "flex-end",
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
