"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Sidebar, type NavSection } from "./Sidebar";
import { Header } from "./Header";
import { NotificationBell } from "./NotificationBell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useT } from "@/context/TranslationContext";


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
  const [domain, setDomain] = useState("DEMO1");

  const t = useT();

  const NAV_SECTIONS: NavSection[] = useMemo(() => [
    { key: "admin", label: t("nav.administration", "Administration"), icon: "settings", items: [
      { key: "users", label: t("nav.users", "Users and Groups"), icon: "users" },
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
    { key: "i18n", label: t("nav.i18n", "Internationalization"), icon: "globe", items: [
      { key: "locales", label: t("nav.locales", "Locales"), icon: "globe" },
      { key: "translations", label: t("nav.translations", "Translations"), icon: "messageSquare" },
    ]},
  ], [t]);

  const activeNav = controlledNav ?? internalNav;
  const handleNavigate = (key: string, recordOid?: string) => {
    console.log("[AppShell] handleNavigate", { key, recordOid, hasOnNavigate: !!onNavigate });
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
          domains={["DEMO1", "DEMO2"]}
          onDomainChange={setDomain}
          userName="Frank Salesi"
          userInitials="FS"
          notificationSlot={<NotificationBell onNavigate={handleNavigate} />}
        />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

export { useIsMobile } from "@/hooks/useIsMobile";
