"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);
  return createPortal(
    <div ref={ref} onClick={e => e.target === ref.current && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}>
      <div style={{ background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 25px 50px -12px rgba(0,0,0,.25)",
        width: "min(800px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>, document.body
  );
}
