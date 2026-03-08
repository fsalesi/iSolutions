"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useSession } from "@/context/SessionContext";
import LoginScreen from "@/components/LoginScreen";
import { AppShell } from "@/components/shell/AppShell";
import { resolvePage, type PageInstance } from "@/page-defs/registry";

export default function Home() {
  const { loggedIn, ready } = useSession();
  const [activeNav, setActiveNav]     = useState(() => typeof window !== "undefined" ? sessionStorage.getItem("isolutions.nav") ?? "" : "");
  const [page, setPage]               = useState<PageInstance | null>(null);
  const [content, setContent]         = useState<ReactNode>(null);

  // Resolve page whenever activeNav changes
  useEffect(() => {
    if (!activeNav.startsWith("form:")) {
      setPage(null);
      setContent(null);
      return;
    }
    const formKey = activeNav.slice(5); // strip "form:"
    resolvePage(formKey).then(p => {
      setPage(p);
      setContent(p ? p.render() : (
        <div style={{ padding: "2rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Page not yet implemented: {formKey}
        </div>
      ));
    });
  }, [activeNav]);

  if (!ready)    return null;
  if (!loggedIn) return <LoginScreen />;

  const title = page?.title ?? "iSolutions";

  return (
    <AppShell title={title} activeNav={activeNav} onNavigate={nav => {
        sessionStorage.setItem("isolutions.nav", nav);
        setActiveNav(nav);
      }}>
      <div key={activeNav} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {content ?? (
          <div style={{ padding: "2rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Select a page from the sidebar.
          </div>
        )}
      </div>
    </AppShell>
  );
}
