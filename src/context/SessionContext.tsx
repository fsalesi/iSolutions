"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type SessionUser = {
  oid: string;
  userId: string;
  fullName: string;
  email: string;
  locale: string;
  domains: string;
  supervisorId: string;
  approvalLimit: number;
  groups: string[];
  isAdmin: boolean;
};

type SessionContextType = {
  user: SessionUser;
  loggedIn: boolean;
  ready: boolean;
  domain: string;
  form: string;
  login: (userId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  setDomain: (d: string) => void;
  setForm: (f: string) => void;
  setUserLocale: (locale: string) => void;
};

const EMPTY_USER: SessionUser = {
  oid: "", userId: "", fullName: "", email: "", locale: "en-us",
  domains: "", supervisorId: "", approvalLimit: 0,
  groups: [], isAdmin: false,
};

const SessionContext = createContext<SessionContextType>({
  user: EMPTY_USER,
  loggedIn: false,
  ready: false,
  domain: "",
  form: "",
  login: async () => ({ ok: false }),
  logout: () => {},
  setDomain: () => {},
  setForm: () => {},
  setUserLocale: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser>(EMPTY_USER);
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [domain, setDomainState] = useState("");
  const [form, setFormState] = useState("");

  // Check for existing session on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : Promise.reject("not logged in"))
      .then(data => {
        setUser(data);
        setLoggedIn(true);
        if (data.domains) {
          const first = data.domains.split(",")[0]?.trim();
          if (first) setDomainState(first);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (userId: string, _password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password: _password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || "Login failed" };
      setUser(data);
      setLoggedIn(true);
      // Set initial domain
      if (data.domains) {
        const first = data.domains.split(",")[0]?.trim();
        if (first) setDomainState(first);
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, []);

  const logout = useCallback(() => {
    // Don't update state — just clear the cookie and hard-redirect.
    // If we setLoggedIn(false) first, LoginScreen mounts before the redirect
    // fires and the SSO auto-redirect wins the race.
    fetch("/api/auth/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => { window.location.href = "/logged-out"; });
  }, []);

  const setDomain = useCallback((d: string) => setDomainState(d), []);
  const setForm = useCallback((f: string) => setFormState(f), []);
  const setUserLocale = useCallback((locale: string) => {
    setUser((prev) => ({ ...prev, locale }));
  }, []);

  return (
    <SessionContext.Provider value={{ user, loggedIn, ready, domain, form, login, logout, setDomain, setForm, setUserLocale }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
