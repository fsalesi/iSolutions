"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getCatalogBundle, resolveText, splitTranslationKey } from "@/lib/i18n/resolve";
import { setClientTranslations } from "@/lib/i18n/runtime";
import type { TranslationBundle, TranslationParams, TranslatableText } from "@/lib/i18n/types";

type TranslationMap = TranslationBundle;

interface TranslationContextValue {
  t: (value: TranslatableText, fallback?: string, params?: TranslationParams) => string;
  locale: string;
  setLocale: (code: string) => void;
  ready: boolean;
  editMode: boolean;
  setEditMode: (on: boolean) => void;
  updateTranslation: (key: string, value: string) => Promise<void>;
}

const TranslationContext = createContext<TranslationContextValue>({
  t: (value, fallback, params) => {
    const input = typeof value === "string" && fallback
      ? { key: value, fallback, params }
      : value;
    return resolveText(input, getCatalogBundle("en-us"), params);
  },
  locale: "en-us",
  setLocale: () => {},
  ready: false,
  editMode: false,
  setEditMode: () => {},
  updateTranslation: async () => {},
});

export function useTranslation() {
  return useContext(TranslationContext);
}

export function useT() {
  return useContext(TranslationContext).t;
}

interface TranslationProviderProps {
  children: ReactNode;
  defaultLocale?: string;
}

export function TranslationProvider({ children, defaultLocale = "en-us" }: TranslationProviderProps) {
  const [locale, setLocaleState] = useState(defaultLocale);
  const [translations, setTranslations] = useState<TranslationMap>(getCatalogBundle(defaultLocale));
  const [ready, setReady] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setLocaleState(defaultLocale);
  }, [defaultLocale]);

  const setLocale = useCallback((code: string) => setLocaleState(code), []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    fetch(`/api/translations/bundle?locale=${encodeURIComponent(locale)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: TranslationMap) => {
        if (cancelled) return;
        const merged = getCatalogBundle(locale, data);
        setTranslations(merged);
        setClientTranslations(locale, data);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        const merged = getCatalogBundle(locale);
        setTranslations(merged);
        setClientTranslations(locale);
        setReady(true);
      });

    return () => { cancelled = true; };
  }, [locale]);

  const t = useCallback(
    (value: TranslatableText, fallback?: string, params?: TranslationParams): string => {
      const input = typeof value === "string" && fallback
        ? { key: value, fallback, params }
        : value;
      return resolveText(input, translations, params);
    },
    [translations]
  );

  const updateTranslation = useCallback(
    async (key: string, value: string) => {
      const { namespace, key: leafKey } = splitTranslationKey(key);
      const res = await fetch("/api/translations/inline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, namespace, key: leafKey, value }),
      });

      if (res.ok) {
        setTranslations((prev) => {
          const next = { ...prev, [key]: value };
          setClientTranslations(locale, next);
          return next;
        });
      }
    },
    [locale]
  );

  return (
    <TranslationContext.Provider value={{ t, locale, setLocale, ready, editMode, setEditMode, updateTranslation }}>
      {children}
    </TranslationContext.Provider>
  );
}
