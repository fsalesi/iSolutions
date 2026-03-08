"use client";

import { useTheme } from "@/components/theme";
import { Flag } from "@/components/ui/Flag";
import { Icon } from "@/components/icons/Icon";
import { useSession } from "@/context/SessionContext";
import { useTranslation } from "@/context/TranslationContext";
import { tx } from "@/lib/i18n/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UserMenuProps {
  onNavigate?: (key: string) => void;
}

interface LocaleOption {
  code: string;
  description: string;
  flag_svg?: string | null;
}

const FALLBACK_LOCALES: LocaleOption[] = [
  { code: "en-us", description: "English (US)" },
  { code: "it-it", description: "Italiano" },
];

export function UserMenu({ onNavigate }: UserMenuProps) {
  const { user, logout, setUserLocale } = useSession();
  const { theme, toggle: toggleTheme } = useTheme();
  const { locale, setLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [localeOptions, setLocaleOptions] = useState<LocaleOption[]>(FALLBACK_LOCALES);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setLocaleMenuOpen(false);
      return;
    }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setLocaleMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (localeMenuOpen) setLocaleMenuOpen(false);
        else setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, localeMenuOpen]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/locales?limit=200&offset=0", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        const mapped = rows
          .filter((row: any) => row?.code)
          .map((row: any) => ({
            code: String(row.code).toLowerCase(),
            description: String(row.description || row.code),
            flag_svg: row.flag_svg || null,
          }));
        if (!mapped.length) return;
        const merged = [...mapped];
        for (const fallback of FALLBACK_LOCALES) {
          if (!merged.some(option => option.code === fallback.code)) merged.push(fallback);
        }
        setLocaleOptions(merged);
      })
      .catch(() => setLocaleOptions(FALLBACK_LOCALES));
  }, [open]);

  const initials = useMemo(() => {
    if (!user.fullName) return "?";
    return user.fullName.split(/\s+/).map(p => p[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("");
  }, [user.fullName]);

  const currentLocale = useMemo(
    () => localeOptions.find(option => option.code === locale.toLowerCase())
      || localeOptions.find(option => option.code === (user.locale || "en-us").toLowerCase())
      || FALLBACK_LOCALES[0],
    [localeOptions, locale, user.locale]
  );

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  const handleSelectLocale = useCallback(async (nextLocale: string) => {
    const previousLocale = locale;
    setLocale(nextLocale);
    setUserLocale(nextLocale);
    setLocaleMenuOpen(false);
    try {
      const res = await fetch("/api/users/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userId, locale: nextLocale }),
      });
      if (!res.ok) throw new Error("locale update failed");
    } catch {
      setLocale(previousLocale);
      setUserLocale(previousLocale);
    }
  }, [locale, setLocale, setUserLocale, user.userId]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1 rounded-md transition-colors"
        style={{ color: "var(--header-text)", background: open ? "var(--header-control-bg)" : "transparent" }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "var(--header-control-hover)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <span className="hidden md:inline text-xs">{user.fullName || user.userId}</span>
        <Avatar oid={user.oid} initials={initials} size={28} />
        <Icon name="chevDown" size={11} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[240px]"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="flex items-center gap-3 px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <Avatar oid={user.oid} initials={initials} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {user.fullName || user.userId}
              </div>
              {user.email && (
                <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{user.email}</div>
              )}
            </div>
          </div>

          <div className="relative">
            <MenuItem
              value={
                <span className="inline-flex items-center gap-2">
                  <Flag svg={currentLocale.flag_svg} size={14} />
                  <span>{currentLocale.description}</span>
                </span>
              }
              onClick={() => setLocaleMenuOpen(value => !value)}
              keepOpen
            />

            {localeMenuOpen && (
              <div
                className="absolute top-0 right-[calc(100%+6px)] rounded-lg py-1 min-w-[220px] z-[60]"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                {localeOptions.map(option => {
                  const selected = option.code === locale.toLowerCase();
                  return (
                    <button
                      key={option.code}
                      onClick={() => void handleSelectLocale(option.code)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
                      style={{
                        color: "var(--text-primary)",
                        background: selected ? "var(--bg-hover, rgba(0,0,0,0.04))" : "transparent",
                      }}
                      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
                      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
                    >
                      <Flag svg={option.flag_svg} size={15} />
                      <span className="flex-1 truncate">{option.description}</span>
                      {selected && <Icon name="check" size={14} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <MenuItem
            icon={theme === "light" ? "moon" : "sun"}
            label={theme === "light"
              ? t(tx("shell.user_menu.dark_mode", "Dark Mode"))
              : t(tx("shell.user_menu.light_mode", "Light Mode"))}
            onClick={() => { toggleTheme(); setOpen(false); }}
          />

          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />

          <MenuItem
            icon="logOut"
            label={t(tx("shell.user_menu.sign_out", "Sign Out"))}
            onClick={handleLogout}
          />
        </div>
      )}
    </div>
  );
}

function Avatar({ oid, initials, size }: { oid: string; initials: string; size: number }) {
  const [error, setError] = useState(false);
  const src = oid ? `/api/users/photo?oid=${oid}` : "";

  useEffect(() => { setError(false); }, [oid]);

  if (!src || error) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
        style={{
          width: size, height: size,
          background: "var(--accent)", color: "var(--accent-text)",
          fontSize: size * 0.38,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src} alt="" onError={() => setError(true)}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

function MenuItem({ icon, label, value, onClick, keepOpen = false }: { icon?: string; label?: string; value?: React.ReactNode; onClick: () => void; keepOpen?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
      style={{ color: "var(--text-primary)" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      data-keep-open={keepOpen ? "true" : undefined}
    >
      {icon && <Icon name={icon} size={14} />}
      {label && <span>{label}</span>}
      <span
        className={`inline-flex items-center gap-2 ${label || icon ? "ml-auto" : "w-full justify-between"}`}
        style={{ color: "var(--text-muted)" }}
      >
        {value}
        {keepOpen && <Icon name="chevLeft" size={13} />}
      </span>
    </button>
  );
}
