"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/context/TranslationContext";

/* ── Types ── */
interface ConfirmOptions {
  /** Main message — already translated by caller */
  message: string;
  /** Optional title (defaults to "Confirm") */
  title?: string;
  /** Confirm button label (defaults to t("confirm.ok")) */
  confirmLabel?: string;
  /** Cancel button label (defaults to t("confirm.cancel")) */
  cancelLabel?: string;
  /** "danger" makes confirm button red; "default" uses accent */
  variant?: "default" | "danger";
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

/* ── Provider ── */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [state, setState] = useState<{
    open: boolean;
    opts: ConfirmOptions;
    resolve: ((v: boolean) => void) | null;
  }>({ open: false, opts: { message: "" }, resolve: null });

  const confirm: ConfirmFn = useCallback((optsOrMsg) => {
    const opts: ConfirmOptions =
      typeof optsOrMsg === "string" ? { message: optsOrMsg } : optsOrMsg;

    return new Promise<boolean>((resolve) => {
      setState({ open: true, opts, resolve });
    });
  }, []);

  const handleResult = useCallback((result: boolean) => {
    setState((prev) => {
      prev.resolve?.(result);
      return { open: false, opts: { message: "" }, resolve: null };
    });
  }, []);

  // Keyboard: Enter = confirm, Escape = cancel
  useEffect(() => {
    if (!state.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); handleResult(false); }
      if (e.key === "Enter") { e.preventDefault(); handleResult(true); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [state.open, handleResult]);

  const { open, opts } = state;
  const isDanger = opts.variant === "danger";

  const title = opts.title ?? t("confirm.title", "Confirm");
  const confirmLabel = opts.confirmLabel ?? (isDanger ? t("confirm.delete", "Delete") : t("confirm.ok", "OK"));
  const cancelLabel = opts.cancelLabel ?? t("confirm.cancel", "Cancel");

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "confirm-fade-in 0.15s ease-out",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleResult(false); }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              padding: "24px 28px",
              minWidth: 340,
              maxWidth: 440,
              animation: "confirm-scale-in 0.15s ease-out",
            }}
          >
            {/* Title */}
            <h3 style={{
              margin: "0 0 12px 0",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}>
              {title}
            </h3>

            {/* Message */}
            <p style={{
              margin: "0 0 24px 0",
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--text-secondary)",
            }}>
              {opts.message}
            </p>

            {/* Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleResult(false)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleResult(true)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: isDanger ? "var(--danger-text)" : "var(--accent)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDanger ? "#b91c1c" : "var(--accent-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDanger ? "var(--danger-text)" : "var(--accent)";
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes confirm-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes confirm-scale-in { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </ConfirmContext.Provider>
  );
}
