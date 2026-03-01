"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { TranslationProvider } from "@/context/TranslationContext";

/** Reads the user's locale from AuthContext and passes it to TranslationProvider */
export function LocaleFromAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <TranslationProvider defaultLocale={user.locale || "en-us"}>
      {children}
    </TranslationProvider>
  );
}
