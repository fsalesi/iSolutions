"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Sidebar, type NavSection } from "./Sidebar";
import { Header } from "./Header";
import { NotificationBell } from "./NotificationBell";
import { ProfileDialog } from "./ProfileDialog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useT } from "@/context/TranslationContext";
import { useSession } from "@/context/SessionContext";


interface AppShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  activeNav?: string;
  onNavigate?: (key: string, recordOid?: string) => void;
}

export function AppShell({ children, title, subtitle, showBack, onBack, activeNav: controlledNav, onNavigate }: AppShellProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [internalNav, setInternalNav] = useState("users");
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, domain, setDomain, setForm } = useSession();

  // Build domain list from user's domains
  const domainList = useMemo(() => {
    if (!user.domains) return [];
    return user.domains.split(",").map(d => d.trim()).filter(Boolean);
  }, [user.domains]);

  // Dynamic menu entries from generated forms
  const [genForms, setGenForms] = useState<{form_key:string;form_name:string;menu_category:string}[]>([]);
  useEffect(() => {
    fetch("/api/nav").then(r => r.json()).then(setGenForms).catch(() => {});
  }, []);
  const t = useT();

  const NAV_SECTIONS: NavSection[] = useMemo(() => [
    { key: "admin", label: t("nav.administration", "Administration"), icon: "settings", items: [
      { key: "users", label: t("nav.users", "Users"), icon: "users" },
      { key: "groups", label: t("nav.groups", "Groups"), icon: "users" },
      { key: "pasoe_brokers", label: t("nav.pasoe_brokers", "PASOE Brokers"), icon: "server" },
      { key: "settings", label: t("nav.settings", "System Settings"), icon: "settings" },
      { key: "jobs", label: t("nav.jobs", "Jobs"), icon: "clock" },
      { key: "audit", label: t("nav.audit", "Audit Trail"), icon: "shield" },
      { key: "email", label: t("nav.email", "Email Queue"), icon: "mail" },
      { key: "security", label: t("nav.security", "Security"), icon: "lock" },
    ]},
    { key: "ipurchase", label: t("nav.ipurchase", "iPurchase"), icon: "briefcase", items: [
      { key: "requisitions", label: t("nav.requisitions", "Requisitions"), icon: "briefcase" },
      { key: "approvals", label: t("nav.approvals", "Approvals"), icon: "check" },
      { key: "reports", label: t("nav.reports", "Reports"), icon: "chart" },
    ]},
    { key: "iapprove", label: t("nav.iapprove", "iApprove"), icon: "check", items: [
      { key: "forms", label: t("nav.forms", "Workflow Forms"), icon: "briefcase" },
      { key: "rules", label: t("nav.rules", "Approval Rules"), icon: "shield" },
    ]},
    { key: "platform", label: t("nav.platform", "Platform"), icon: "edit", items: [
      { key: "entity_designer", label: t("nav.entity_designer", "Entity Designer"), icon: "edit" },
    ]},
    { key: "i18n", label: t("nav.i18n", "Internationalization"), icon: "globe", items: [
      { key: "locales", label: t("nav.locales", "Locales"), icon: "globe" },
      { key: "translations", label: t("nav.translations", "Translations"), icon: "messageSquare" },
    ]},
  ].map(sec => {
    const extra = genForms
      .filter(f => f.menu_category.toLowerCase() === sec.key)
      .map(f => ({ key: `form:${f.form_key}`, label: f.form_name, icon: "fileText" }));
    return extra.length ? { ...sec, items: [...sec.items, ...extra] } : sec;
  }), [t, genForms]);

  const activeNav = controlledNav ?? internalNav;
  const handleNavigate = (key: string, recordOid?: string) => {
    if (key === "profile") { setProfileOpen(true); return; }
    // Clear form context on every nav click — page will set its own if needed
    setForm("");
    onNavigate?.(key, recordOid) ?? setInternalNav(key);
    setSidebarOpen(false);
  };



  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: "var(--bg-body)" }}>
      <Sidebar
        sections={NAV_SECTIONS}
        activeItem={activeNav}
        onNavigate={handleNavigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          showBack={isMobile && showBack}
          onBackClick={onBack}
          domain={domain}
          domains={domainList}
          onDomainChange={setDomain}
          notificationSlot={<NotificationBell onNavigate={handleNavigate} />}
          onNavigate={handleNavigate}
        />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

export { useIsMobile } from "@/hooks/useIsMobile";
