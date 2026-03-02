"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { substitute } from "@/lib/substitute";

type TranslationMap = Record<string, string>;

interface TranslationContextValue {
  /** Translate a key. Returns the translated value, or the fallback (defaults to key). */
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
  /** Current locale code */
  locale: string;
  /** Switch locale */
  setLocale: (code: string) => void;
  /** Whether translations are loaded */
  ready: boolean;
  /** Whether inline translation editing is active */
  editMode: boolean;
  /** Toggle inline edit mode */
  setEditMode: (on: boolean) => void;
  /** Update a single translation (writes to DB and local cache) */
  updateTranslation: (key: string, value: string) => Promise<void>;
}

const TranslationContext = createContext<TranslationContextValue>({
  t: (key, fallback, params) => substitute(fallback ?? key, params),
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

/** Shorthand — just the t function */
export function useT() {
  return useContext(TranslationContext).t;
}

interface TranslationProviderProps {
  children: ReactNode;
  defaultLocale?: string;
}

export function TranslationProvider({ children, defaultLocale = "en-us" }: TranslationProviderProps) {
  const [locale, setLocaleState] = useState(defaultLocale);
  const [translations, setTranslations] = useState<TranslationMap>({});

  // Sync locale when defaultLocale prop changes (e.g. auth loads)
  useEffect(() => {
    setLocaleState(defaultLocale);
  }, [defaultLocale]);

  // Wrap setLocale so both internal and external callers update state
  const setLocale = useCallback((code: string) => setLocaleState(code), []);
  const [ready, setReady] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Load all translations for current locale
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    console.log("[i18n] Loading translations for locale:", locale);

    fetch(`/api/translations/bundle?locale=${encodeURIComponent(locale)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: TranslationMap) => {
        if (!cancelled) {
          console.log("[i18n] Loaded", Object.keys(data).length, "keys for", locale);
          setTranslations(data);
          setReady(true);
        }
      })
      .catch((err) => {
        console.error("Failed to load translations:", err);
        if (!cancelled) setReady(true); // proceed with fallbacks
      });

    return () => { cancelled = true; };
  }, [locale]);

  const t = useCallback(
    (key: string, fallback?: string, params?: Record<string, string | number>): string => {
      const raw = translations[key] ?? fallback ?? key;
      return params ? substitute(raw, params) : raw;
    },
    [translations]
  );

  const updateTranslation = useCallback(
    async (key: string, value: string) => {
      // Parse key into namespace.key
      const dotIdx = key.indexOf(".");
      const ns = dotIdx > 0 ? key.slice(0, dotIdx) : "global";
      const k = dotIdx > 0 ? key.slice(dotIdx + 1) : key;

      const res = await fetch("/api/translations/inline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, namespace: ns, key: k, value }),
      });

      if (res.ok) {
        // Update local cache immediately
        setTranslations((prev) => ({ ...prev, [key]: value }));
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
