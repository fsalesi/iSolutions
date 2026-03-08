"use client";

import { useT } from "@/context/TranslationContext";

/**
 * InlineConfirm — small inline confirmation bar (e.g. delete confirmation).
 */
export function InlineConfirm({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
    >
      <span style={{ color: "var(--text-primary)" }}>{message}</span>
      <button
        onClick={onConfirm}
        className="px-2.5 py-1 rounded font-medium text-white"
        style={{ background: "#ef4444", fontSize: 11 }}
      >
        {t("crud.delete", "Delete")}
      </button>
      <button
        onClick={onCancel}
        className="px-2.5 py-1 rounded font-medium"
        style={{ color: "var(--text-muted)", fontSize: 11 }}
      >
        {t("crud.cancel", "Cancel")}
      </button>
    </div>
  );
}
