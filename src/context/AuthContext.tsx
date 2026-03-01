"use client";

import { createContext, useContext, type ReactNode } from "react";

type AuthUser = {
  userId: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
};

type AuthContextType = {
  user: AuthUser;
  /** True once auth is resolved (always true for now) */
  ready: boolean;
};

// TODO: Replace with real auth — session cookie, JWT, OAuth, etc.
const MOCK_USER: AuthUser = {
  userId: "frank",
  fullName: "Frank Salesi",
  email: "frank@salesi.net",
  isAdmin: true,
};

const AuthContext = createContext<AuthContextType>({
  user: MOCK_USER,
  ready: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // When real auth is added, this will:
  //   1. Check session/cookie on mount
  //   2. Set ready=false while loading
  //   3. Redirect to /login if no session
  return (
    <AuthContext.Provider value={{ user: MOCK_USER, ready: true }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
