"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Sidebar, type NavSection } from "./Sidebar";
import { UserMenu } from "./UserMenu";
import { Icon } from "@/components/icons/Icon";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSession } from "@/context/SessionContext";

interface AppShellProps {
  children:    ReactNode;
  title:       string;
  subtitle?:   string;
  activeNav?:  string;
  onNavigate?: (key: string) => void;
}

const SECTION_ICON: Record<string, string>  = { admin: "settings", platform: "edit", i18n: "globe", ipurchase: "briefcase", iapprove: "check" };
const SECTION_LABEL: Record<string, string> = { admin: "Administration", platform: "Platform", i18n: "Internationalization", ipurchase: "iPurchase", iapprove: "iApprove" };

export function AppShell({ children, title, subtitle, activeNav: controlledNav, onNavigate }: AppShellProps) {
  const isMobile   = useIsMobile();
  const { user, domain, setDomain } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [internalNav, setInternalNav] = useState("");
  const [navForms, setNavForms]       = useState<{ form_key: string; form_name: string; menu_category: string }[]>([]);

  // Fetch nav entries from DB
  useEffect(() => {
    fetch("/api/nav").then(r => r.json()).then(setNavForms).catch(() => {});
  }, []);

  // Build nav sections from DB forms
  const sections: NavSection[] = useMemo(() => {
    const byCategory = new Map<string, NavSection>();
    for (const f of navForms) {
      const cat = (f.menu_category || "admin").toLowerCase();
      if (!byCategory.has(cat)) {
        byCategory.set(cat, {
          key:   cat,
          label: SECTION_LABEL[cat] || cat.charAt(0).toUpperCase() + cat.slice(1),
          icon:  SECTION_ICON[cat]  || "fileText",
          items: [],
        });
      }
      byCategory.get(cat)!.items.push({ key: `form:${f.form_key}`, label: f.form_name, icon: "fileText" });
    }
    return Array.from(byCategory.values());
  }, [navForms]);

  const domainList = useMemo(() => {
    if (!user.domains) return [];
    return user.domains.split(",").map(d => d.trim()).filter(Boolean);
  }, [user.domains]);

  const activeNav = controlledNav ?? internalNav;
  const handleNavigate = (key: string) => {
    onNavigate?.(key) ?? setInternalNav(key);
    setSidebarOpen(false);
  };

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--bg-body)" }}>
      <Sidebar
        sections={sections}
        activeItem={activeNav}
        onNavigate={handleNavigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />

      {/* Main column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: (!isMobile && sidebarOpen) ? 240 : 0, transition: "margin-left 0.2s" }}>
        {/* Header */}
        <header
          style={{
            height:       "var(--header-height, 52px)",
            display:      "flex",
            alignItems:   "center",
            padding:      "0 12px",
            gap:          8,
            flexShrink:   0,
            background:   "var(--header-bg)",
            borderBottom: "1px solid var(--header-border)",
          }}
        >
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ color: "var(--header-text-muted)", padding: 6, display: "flex" }}
          >
            <Icon name="menu" size={20} />
          </button>

          {/* Domain picker */}
          {domainList.length > 1 && (
            <select
              value={domain}
              onChange={e => setDomain(e.target.value)}
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                borderRadius: 6,
                padding: "4px 8px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "var(--header-text)",
                cursor: "pointer",
              }}
            >
              {domainList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          {/* Title */}
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--header-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontSize: "0.875rem", color: "var(--header-text-muted)", whiteSpace: "nowrap" }}>
              <span style={{ opacity: 0.3, margin: "0 4px" }}>/</span>{subtitle}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* User menu */}
          <UserMenu onNavigate={handleNavigate} />
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
