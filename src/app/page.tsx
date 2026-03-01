"use client";

import { useState, useCallback } from "react";
import PasoeBrokers from "@/components/pages/PasoeBrokers";
import UsersPage from "@/components/pages/UsersPage";
import Locales from "@/components/pages/Locales";
import Translations from "@/components/pages/Translations";

export default function RootPage() {
  const [activeNav, setActiveNav] = useState("users");
  const [selectOid, setSelectOid] = useState<string | undefined>();
  const [selectSeq, setSelectSeq] = useState(0);

  const handleNavigate = useCallback((key: string, recordOid?: string) => {
    setActiveNav(key);
    setSelectOid(recordOid);
    if (recordOid) setSelectSeq(s => s + 1);
  }, []);

  if (activeNav === "pasoe_brokers") {
    return <PasoeBrokers activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
  }

  if (activeNav === "locales") {
    return <Locales activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
  }

  if (activeNav === "translations") {
    return <Translations activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
  }

  return <UsersPage activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={selectOid} selectSeq={selectSeq} />;
}
