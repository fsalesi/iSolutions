"use client";

import { useState, useCallback } from "react";
import { useSession } from "@/context/SessionContext";
import LoginScreen from "@/components/LoginScreen";
import PasoeBrokers from "@/components/pages/PasoeBrokers";
import UsersPage from "@/components/pages/UsersPage";
import Locales from "@/components/pages/Locales";
import Translations from "@/components/pages/Translations";
import Settings from "@/components/pages/Settings";

export default function RootPage() {
  const { loggedIn, ready } = useSession();
  const [activeNav, setActiveNav] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("activeNav") || "users";
    }
    return "users";
  });
  const [selectOid, setSelectOid] = useState<string | undefined>();
  const [selectSeq, setSelectSeq] = useState(0);

  const handleNavigate = useCallback((key: string, recordOid?: string) => {
    setActiveNav(key);
    sessionStorage.setItem("activeNav", key);
    setSelectOid(recordOid);
    if (recordOid) setSelectSeq(s => s + 1);
  }, []);

  // Wait for session check to complete
  if (!ready) return null;

  // Not logged in — show login screen
  if (!loggedIn) return <LoginScreen />;

  if (activeNav === "pasoe_brokers") {
    return <PasoeBrokers activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
  }

  if (activeNav === "locales") {
    return <Locales activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
  }

  if (activeNav === "settings") {
    return <Settings activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
  }

  if (activeNav === "translations") {
    return <Translations activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
  }

  return <UsersPage activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
}
