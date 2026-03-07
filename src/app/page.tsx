"use client";

import { useState, useCallback } from "react";
import { useSession } from "@/context/SessionContext";
import LoginScreen from "@/components/LoginScreen";
import Settings from "@/components/pages/Settings";
import EntityDesigner from "@/components/pages/EntityDesigner";
import { FormPage } from "@/components/pages/FormPage";
import { formPageRegistry } from "@/components/forms/registry";

function normalizeNavKey(raw: string | null): string {
  const key = String(raw || "").trim();
  if (!key) return "form:users";
  if (key === "users") return "form:users";
  if (key === "groups") return "form:groups";
  if (key === "pasoe_brokers") return "form:pasoe_brokers";
  if (key === "locales") return "form:locales";
  if (key === "translations") return "form:translations";
  return key;
}

export default function RootPage() {
  const { loggedIn, ready } = useSession();
  const [activeNav, setActiveNav] = useState(() => {
    if (typeof window !== "undefined") {
      return normalizeNavKey(sessionStorage.getItem("activeNav"));
    }
    return "form:users";
  });
  const [selectOid, setSelectOid] = useState<string | undefined>();
  const [selectSeq, setSelectSeq] = useState(0);

  const HARD_WIRED = new Set(["settings", "entity_designer", "profile"]);
  const handleNavigate = useCallback((key: string, recordOid?: string) => {
    const normalized = normalizeNavKey(key);
    const resolved = (!normalized.startsWith("form:") && !HARD_WIRED.has(normalized)) ? `form:${normalized}` : normalized;
    setActiveNav(resolved);
    sessionStorage.setItem("activeNav", resolved);
    setSelectOid(recordOid);
    if (recordOid) setSelectSeq(s => s + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for session check to complete
  if (!ready) return null;

  // Not logged in — show login screen
  if (!loggedIn) return <LoginScreen />;

  if (activeNav === "settings") {
    return <Settings activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
  }

  if (activeNav === "entity_designer") {
    return <EntityDesigner activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
  }


  if (activeNav.startsWith("form:")) {
    const formKey = activeNav.slice(5);
    // Three-tier resolution: registry has generated page -> fallback to generic FormPage
    const RegisteredPage = formPageRegistry[formKey];
    if (RegisteredPage) {
      return <RegisteredPage activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
    }
    return <FormPage formKey={formKey} apiPath={`/api/forms/${formKey}`} activeNav={activeNav} onNavigate={handleNavigate} />;
  }

  return <FormPage formKey="users" apiPath="/api/forms/users" activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
}
