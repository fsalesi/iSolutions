"use client";

import { type ReactNode } from "react";
import { useSession } from "@/context/SessionContext";
import { TranslationProvider } from "@/context/TranslationContext";

/** Reads the user's locale from SessionContext and passes it to TranslationProvider */
export function LocaleFromAuth({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return (
    <TranslationProvider defaultLocale={user.locale || "en-us"}>
      {children}
    </TranslationProvider>
  );
}
