"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/icons/Icon";
import { Flag } from "@/components/ui/Flag";
import { useTranslation } from "@/context/TranslationContext";
import { useAuth } from "@/context/AuthContext";

type LocaleRecord = { code: string; description: string; flag_svg?: string };

export function LocalePicker() {
  const { locale, setLocale } = useTranslation();
  const { user } = useAuth();
  const [locales, setLocales] = useState<LocaleRecord[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/locales?limit=100&sort=code&dir=asc")
      .then(r => r.json())
      .then(d => setLocales(d.rows || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = async (code: string) => {
    setOpen(false);
    if (code === locale) return;
    setLocale(code);
    try {
      await fetch("/api/users/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userId, locale: code }),
      });
    } catch { /* best-effort */ }
  };

  if (locales.length <= 1) return null;

  const current = locales.find(l => l.code === locale);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-1.5 py-1.5 rounded-md transition-colors"
        style={{
          background: open ? "var(--bg-hover)" : "transparent",
          color: "var(--text-secondary)",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = open ? "var(--bg-hover)" : "transparent"; }}
        title="Change language"
      >
        <Flag svg={current?.flag_svg} size={16} />
        <Icon name="chevDown" size={11} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[190px]"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg, 0 10px 25px rgba(0,0,0,.15))",
          }}
        >
          {locales.map(l => {
            const isActive = l.code === locale;
            return (
              <button
                key={l.code}
                onClick={() => handleSelect(l.code)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
                style={{
                  background: isActive ? "var(--accent-bg, rgba(59,130,246,0.08))" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-primary)",
                  fontWeight: isActive ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isActive ? "var(--accent-bg, rgba(59,130,246,0.08))" : "transparent"; }}
              >
                <Flag svg={l.flag_svg} size={18} />
                <span className="flex-1">{l.description}</span>
                {isActive && <Icon name="check" size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
