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
  const [internalNav, setInternalNav] = useState("form:users");
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

  const NAV_SECTIONS: NavSection[] = useMemo(() => {
    const baseSections: NavSection[] = [
      { key: "admin", label: t("nav.administration", "Administration"), icon: "settings", items: [
        { key: "settings", label: t("nav.settings", "System Settings"), icon: "settings" },
      ]},
      { key: "platform", label: t("nav.platform", "Platform"), icon: "edit", items: [
        { key: "entity_designer", label: t("nav.entity_designer", "Entity Designer"), icon: "edit" },
      ]},
      { key: "i18n", label: t("nav.i18n", "Internationalization"), icon: "globe", items: [
        { key: "locales", label: t("nav.locales", "Locales"), icon: "globe" },
        { key: "translations", label: t("nav.translations", "Translations"), icon: "messageSquare" },
      ]},
    ];

    const sectionIcon = (category: string) => {
      if (category === "admin") return "settings";
      if (category === "platform") return "edit";
      if (category === "i18n") return "globe";
      if (category === "ipurchase") return "briefcase";
      if (category === "iapprove") return "check";
      return "fileText";
    };

    const baseByKey = new Map(baseSections.map(s => [s.key, s]));
    const generatedByCategory = new Map<string, { key: string; label: string; icon: string }[]>();

    for (const f of genForms) {
      const category = (f.menu_category || "admin").toLowerCase();
      const list = generatedByCategory.get(category) || [];
      list.push({ key: `form:${f.form_key}`, label: f.form_name, icon: "fileText" });
      generatedByCategory.set(category, list);
    }

    for (const [category, items] of generatedByCategory.entries()) {
      if (!baseByKey.has(category)) {
        baseByKey.set(category, {
          key: category,
          label: category.charAt(0).toUpperCase() + category.slice(1),
          icon: sectionIcon(category),
          items: [],
        });
      }
      const section = baseByKey.get(category)!;
      const seen = new Set(section.items.map(i => i.key));
      for (const item of items) {
        if (!seen.has(item.key)) {
          section.items.push(item);
          seen.add(item.key);
        }
      }
    }

    return Array.from(baseByKey.values()).filter(s => s.items.length > 0);
  }, [t, genForms]);

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
