"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type AuthUser = {
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

type AuthContextType = {
  user: AuthUser;
  /** True once the /api/auth/me call has resolved */
  ready: boolean;
};

const EMPTY_USER: AuthUser = {
  userId: "", fullName: "", email: "", locale: "en-us",
  domains: "", supervisorId: "", approvalLimit: 0,
  groups: [], isAdmin: false,
};

const AuthContext = createContext<AuthContextType>({
  user: EMPTY_USER,
  ready: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(EMPTY_USER);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => setUser(data))
      .catch(err => console.error("[auth] Failed to load session:", err))
      .finally(() => setReady(true));
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
