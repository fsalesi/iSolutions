"use client";

import { useEffect, useState, useCallback } from "react";
import {
  _registerAlertDialogListener,
  _unregisterAlertDialogListener,
  type AlertDialogOptions,
  type AlertDialogVariant,
} from "@/platform/core/AlertDialogService";

const VARIANT_CONFIG: Record<AlertDialogVariant, {
  iconName:     string;
  iconColor:    string;
  iconBg:       string;
  titleColor:   string;
  confirmBg:    string;
  confirmHover: string;
}> = {
  error: {
    iconName:     "CircleX",
    iconColor:    "#dc2626",
    iconBg:       "#fef2f2",
    titleColor:   "#991b1b",
    confirmBg:    "#dc2626",
    confirmHover: "#b91c1c",
  },
  danger: {
    iconName:     "TriangleAlert",
    iconColor:    "#dc2626",
    iconBg:       "#fef2f2",
    titleColor:   "#991b1b",
    confirmBg:    "#dc2626",
    confirmHover: "#b91c1c",
  },
  warning: {
    iconName:     "ShieldAlert",
    iconColor:    "#d97706",
    iconBg:       "#fffbeb",
    titleColor:   "#92400e",
    confirmBg:    "#d97706",
    confirmHover: "#b45309",
  },
  info: {
    iconName:     "Info",
    iconColor:    "#2563eb",
    iconBg:       "#eff6ff",
    titleColor:   "#1e40af",
    confirmBg:    "#2563eb",
    confirmHover: "#1d4ed8",
  },
};

interface DialogState {
  options: AlertDialogOptions;
  resolve: (result: boolean) => void;
}

export function AlertDialogRenderer() {
  const [dialog,         setDialog]         = useState<DialogState | null>(null);
  const [confirmHovered, setConfirmHovered] = useState(false);
  const [cancelHovered,  setCancelHovered]  = useState(false);

  useEffect(() => {
    _registerAlertDialogListener((options, resolve) => {
      setDialog({ options, resolve });
      setConfirmHovered(false);
      setCancelHovered(false);
    });
    return () => _unregisterAlertDialogListener();
  }, []);

  const confirm = useCallback(() => {
    if (!dialog) return;
    const resolve = dialog.resolve;
    setDialog(null);
    resolve(true);
  }, [dialog]);

  const cancel = useCallback(() => {
    if (!dialog) return;
    const resolve = dialog.resolve;
    setDialog(null);
    resolve(false);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter")  { e.preventDefault(); confirm(); }
      if (e.key === "Escape") { e.preventDefault(); cancel();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, confirm, cancel]);

  if (!dialog) return null;

  const { variant, title, message, confirmLabel, cancelLabel } = dialog.options;
  const cfg = VARIANT_CONFIG[variant];
  const showCancel = variant === "danger" || variant === "warning";

  return (
    <>
      <div onClick={cancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, backdropFilter: "blur(2px)" }} />

      <div role="dialog" aria-modal="true" aria-labelledby="alert-dialog-title" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 9001, width: "min(440px, 90vw)", background: "var(--bg-surface, #fff)", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Icon + Text — side by side */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", padding: "1.75rem 1.75rem 1.25rem" }}>
          <div style={{ flexShrink: 0, width: 72, height: 72, borderRadius: "50%", background: cfg.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DialogIcon name={cfg.iconName} size={40} color={cfg.iconColor} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="alert-dialog-title" style={{ fontSize: "1.1rem", fontWeight: 800, color: cfg.titleColor, marginBottom: "0.35rem" }}>
              {title}
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-muted, #6b7280)", lineHeight: 1.55 }}>
              {message}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "0.75rem", padding: "1rem 1.5rem 1.5rem", justifyContent: "center" }}>
          {showCancel && (
            <button onClick={cancel} onMouseEnter={() => setCancelHovered(true)} onMouseLeave={() => setCancelHovered(false)}
              style={{ flex: 1, maxWidth: 160, padding: "0.6rem 1.25rem", borderRadius: 8, border: "1px solid var(--border, #d1d5db)", background: cancelHovered ? "var(--bg-muted, #f3f4f6)" : "transparent", color: "var(--text-primary, #111827)", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}>
              {cancelLabel ?? "Cancel"}
            </button>
          )}
          <button onClick={confirm} onMouseEnter={() => setConfirmHovered(true)} onMouseLeave={() => setConfirmHovered(false)} autoFocus
            style={{ flex: 1, maxWidth: 160, padding: "0.6rem 1.25rem", borderRadius: 8, border: "none", background: confirmHovered ? cfg.confirmHover : cfg.confirmBg, color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}>
            {confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </>
  );
}

function DialogIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const paths: Record<string, string> = {
    CircleX:      "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.536 6.464-7.072 7.072M8.464 8.464l7.072 7.072",
    TriangleAlert:"M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
    ShieldAlert:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm0-12v4m0 4h.01",
    Info:         "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14v4m0 4h.01",
  };
  const d = paths[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {d.split(/(?=M)/).filter(Boolean).map((seg, i) => <path key={i} d={seg.trim()} />)}
    </svg>
  );
}
