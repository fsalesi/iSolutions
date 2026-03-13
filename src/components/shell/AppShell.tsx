"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Sidebar, type NavSection } from "./Sidebar";
import { UserMenu } from "./UserMenu";
import { Icon } from "@/components/icons/Icon";
import { tx } from "@/lib/i18n/types";
import { AlertDialogRenderer } from "@/components/dialog/AlertDialogRenderer";
import { DrawerProvider } from "@/context/DrawerContext";
import { DrawerRenderer } from "@/components/drawer/DrawerRenderer";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSession } from "@/context/SessionContext";

interface AppShellProps {
  children:    ReactNode;
  title:       string;
  subtitle?:   string;
  activeNav?:  string;
  onNavigate?: (key: string) => void;
}

const NAV_SECTIONS: NavSection[] = [
  {
    key: "ipurchase",
    label: tx("shell.sections.ipurchase", "iPurchase"),
    icon: "briefcase",
    items: [
      { key: "form:requisition", label: tx("shell.items.requisition", "PO Reqs"), icon: "fileText" },
    ],
  },
  {
    key: "admin",
    label: tx("shell.sections.admin", "Administration"),
    icon: "settings",
    items: [
      { key: "form:groups",        label: tx("shell.items.groups", "Groups"),           icon: "fileText" },
      { key: "form:forms",         label: tx("shell.items.forms", "Forms"),             icon: "fileText" },
      { key: "form:locales",       label: tx("shell.items.locales", "Locales"),          icon: "fileText" },
      { key: "form:translations",  label: tx("shell.items.translations", "Translations"),     icon: "fileText" },
      { key: "form:pasoe_brokers", label: tx("shell.items.pasoe_brokers", "PASOE Brokers"),    icon: "fileText" },
      { key: "form:sso_config",    label: tx("shell.items.sso_config", "SSO Configuration"),icon: "fileText" },
      { key: "form:settings", label: tx("shell.items.settings", "System Settings"), icon: "fileText" },
      { key: "form:users",         label: tx("shell.items.users", "Users"),            icon: "fileText" },
    ],
  },
  {
    key: "i18n",
    label: tx("shell.sections.i18n", "Internationalization"),
    icon: "globe",
    items: [],
  },
  {
    key: "platform",
    label: tx("shell.sections.platform", "Platform"),
    icon: "edit",
    items: [
      { key: "tool:test-runner", label: tx("shell.items.test_runner", "Test Runner"), icon: "fileText" },
      { key: "tool:qad-call", label: tx("shell.items.qad_call", "QAD Call Workbench"), icon: "database" },
    ],
  },
];

export function AppShell({ children, title, subtitle, activeNav: controlledNav, onNavigate }: AppShellProps) {
  const isMobile   = useIsMobile();
  const { user, domain, setDomain } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [internalNav, setInternalNav] = useState("");
  const sections = NAV_SECTIONS;

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
    <DrawerProvider>
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
              padding:      "0 14px",
              gap:          8,
              flexShrink:   0,
              background:   "var(--header-bg)",
              borderBottom: "1px solid var(--header-border)",
              boxShadow:    "var(--header-shadow)",
            }}
          >
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{ color: "var(--header-text-muted)", padding: 8, display: "flex", borderRadius: 10, background: "transparent" }}
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
                  background: "var(--header-control-bg)",
                  border: "1px solid var(--header-control-border)",
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

          {/* Content — with DrawerRenderer for slide-in panels */}
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
            {children}
            <DrawerRenderer />
          </div>
        </div>
        <AlertDialogRenderer />
      </div>
    </DrawerProvider>
  );
}
