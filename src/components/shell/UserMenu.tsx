"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Icon } from "@/components/icons/Icon";
import { Flag } from "@/components/ui/Flag";
import { useTranslation } from "@/context/TranslationContext";
import { useSession } from "@/context/SessionContext";
import { useTheme } from "@/components/theme/ThemeProvider";

type LocaleRecord = { code: string; description: string; flag_svg?: string };

interface UserMenuProps {
  onNavigate?: (key: string) => void;
}

export function UserMenu({ onNavigate }: UserMenuProps) {
  const { user, logout } = useSession();
  const { theme, toggle: toggleTheme } = useTheme();
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [locales, setLocales] = useState<LocaleRecord[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch locales for language submenu
  useEffect(() => {
    fetch("/api/locales?limit=100&sort=code&dir=asc")
      .then(r => r.json())
      .then(d => setLocales(d.rows || []))
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setLangOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const userInitials = useMemo(() => {
    if (!user.fullName) return "??";
    const parts = user.fullName.split(/\s+/);
    return parts.map(p => p[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("");
  }, [user.fullName]);

  const currentLocale = locales.find(l => l.code === locale);

  const handleLocaleSelect = async (code: string) => {
    setOpen(false);
    setLangOpen(false);
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

  const handleProfile = () => {
    setOpen(false);
    setLangOpen(false);
    onNavigate?.("profile");
  };

  const handleLogout = () => {
    setOpen(false);
    setLangOpen(false);
    logout();
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger: avatar + name */}
      <button
        onClick={() => { setOpen(o => !o); setLangOpen(false); }}
        className="flex items-center gap-2 px-1.5 py-1 rounded-md transition-colors"
        style={{
          background: open ? "var(--bg-hover)" : "transparent",
          color: "var(--text-secondary)",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = open ? "var(--bg-hover)" : "transparent"; }}
      >
        <span className="hidden md:inline text-xs">{user.fullName || user.userId}</span>
        <UserAvatar oid={user.oid} initials={userInitials} size={28} />
        <Icon name="chevDown" size={11} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[200px]"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg, 0 10px 25px rgba(0,0,0,.15))",
          }}
        >
          {/* User info header */}
          <div className="flex items-center gap-3 px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {user.fullName || user.userId}
              </div>
              {user.email && (
                <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{user.email}</div>
              )}
            </div>
            <UserAvatar oid={user.oid} initials={userInitials} size={72} />
          </div>

          {/* Profile */}
          <MenuItem icon="user" label="Profile" onClick={handleProfile} />

          {/* Language - with submenu */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(o => !o)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <Icon name="globe" size={14} />
              <span className="flex-1">Language</span>
              {currentLocale && <Flag svg={currentLocale.flag_svg} size={14} />}
              <Icon name="chevRight" size={11} />
            </button>

            {langOpen && locales.length > 0 && (
              <div
                className="absolute right-full top-0 mr-1 rounded-lg py-1 z-50 min-w-[190px]"
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
                      onClick={() => handleLocaleSelect(l.code)}
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

          {/* Theme toggle */}
          <MenuItem
            icon={theme === "light" ? "moon" : "sun"}
            label={theme === "light" ? "Dark Mode" : "Light Mode"}
            onClick={() => { toggleTheme(); }}
          />

          {/* Divider + Logout */}
          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
          <MenuItem icon="logOut" label="Sign Out" onClick={handleLogout} />
        </div>
      )}
    </div>
  );
}

function UserAvatar({ oid, initials, size }: { oid: string; initials: string; size: number }) {
  const [error, setError] = React.useState(false);
  const src = oid ? `/api/users/photo?oid=${oid}&t=${Date.now()}` : "";
  React.useEffect(() => { setError(false); }, [src]);

  if (!src || error) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-medium flex-shrink-0"
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

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
      style={{ color: "var(--text-primary)" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <Icon name={icon} size={14} />
      <span>{label}</span>
    </button>
  );
}
