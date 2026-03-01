"use client";

import { useState, type ReactNode } from "react";
import { Sidebar, type NavSection } from "./Sidebar";
import { Header } from "./Header";
import { NotificationBell } from "./NotificationBell";
import { useIsMobile } from "@/hooks/useIsMobile";

const NAV_SECTIONS: NavSection[] = [
  { key: "admin", label: "Administration", icon: "settings", items: [
    { key: "users", label: "Users and Groups", icon: "users" },
    { key: "pasoe_brokers", label: "PASOE Brokers", icon: "server" },
    { key: "settings", label: "System Settings", icon: "settings" },
    { key: "jobs", label: "Jobs", icon: "clock" },
    { key: "audit", label: "Audit Trail", icon: "shield" },
    { key: "email", label: "Email Queue", icon: "mail" },
    { key: "security", label: "Security", icon: "lock" },
  ]},
  { key: "ipurchase", label: "iPurchase", icon: "briefcase", items: [
    { key: "requisitions", label: "Requisitions", icon: "briefcase" },
    { key: "approvals", label: "Approvals", icon: "check" },
    { key: "reports", label: "Reports", icon: "chart" },
  ]},
  { key: "iapprove", label: "iApprove", icon: "check", items: [
    { key: "forms", label: "Workflow Forms", icon: "briefcase" },
    { key: "rules", label: "Approval Rules", icon: "shield" },
  ]},
];

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
