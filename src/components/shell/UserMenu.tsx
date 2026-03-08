"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Icon } from "@/components/icons/Icon";
import { useSession } from "@/context/SessionContext";
import { useTheme } from "@/components/theme";

interface UserMenuProps {
  onNavigate?: (key: string) => void;
}

export function UserMenu({ onNavigate }: UserMenuProps) {
  const { user, logout } = useSession();
  const { theme, toggle: toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const initials = useMemo(() => {
    if (!user.fullName) return "?";
    return user.fullName.split(/\s+/).map(p => p[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("");
  }, [user.fullName]);

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1 rounded-md transition-colors"
        style={{ color: "var(--header-text)", background: open ? "rgba(255,255,255,0.1)" : "transparent" }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <span className="hidden md:inline text-xs">{user.fullName || user.userId}</span>
        <Avatar oid={user.oid} initials={initials} size={28} />
        <Icon name="chevDown" size={11} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[210px]"
          style={{
            background:  "var(--bg-surface)",
            border:      "1px solid var(--border)",
            boxShadow:   "0 10px 25px rgba(0,0,0,.15)",
          }}
        >
          {/* User header */}
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

          {/* Theme toggle */}
          <MenuItem
            icon={theme === "light" ? "moon" : "sun"}
            label={theme === "light" ? "Dark Mode" : "Light Mode"}
            onClick={() => { toggleTheme(); setOpen(false); }}
          />

          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />

          {/* Sign out */}
          <MenuItem icon="logOut" label="Sign Out" onClick={handleLogout} />
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

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
      style={{ color: "var(--text-primary)" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <Icon name={icon} size={14} />
      <span>{label}</span>
    </button>
  );
}
