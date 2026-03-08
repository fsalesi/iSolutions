"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useSession } from "@/context/SessionContext";
import LoginScreen from "@/components/LoginScreen";
import { AppShell } from "@/components/shell/AppShell";
import { resolvePage, type PageInstance } from "@/page-defs/registry";
import { TestRunnerWorkbench } from "@/components/dev/TestRunnerWorkbench";

export default function Home() {
  const { loggedIn, ready } = useSession();
  const [activeNav, setActiveNav] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("isolutions.nav");
    if (saved) setActiveNav(saved);
  }, []);
  const [page, setPage] = useState<PageInstance | null>(null);
  const [toolContent, setToolContent] = useState<ReactNode>(null);

  useEffect(() => {
    let cancelled = false;

    setPage(null);
    setToolContent(null);

    if (activeNav === "tool:test-runner") {
      setToolContent(<TestRunnerWorkbench />);
      return () => {
        cancelled = true;
      };
    }

    if (!activeNav.startsWith("form:")) {
      return () => {
        cancelled = true;
      };
    }

    const formKey = activeNav.slice(5);
    void resolvePage(formKey).then((nextPage) => {
      if (cancelled) return;
      setPage(nextPage);
    });

    return () => {
      cancelled = true;
    };
  }, [activeNav]);

  if (!ready) return null;
  if (!loggedIn) return <LoginScreen />;

  const title = activeNav === "tool:test-runner" ? "Test Runner" : (page?.title ?? "iSolutions");
  const content = toolContent ?? (page
    ? page.render()
    : (activeNav.startsWith("form:")
      ? <div style={{ padding: "2rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</div>
      : null));

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
