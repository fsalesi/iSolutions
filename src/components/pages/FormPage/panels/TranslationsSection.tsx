"use client";
import { useState, useEffect } from "react";
import { Field, Input } from "@/components/ui";

const LOCALE_NAMES: Record<string, string> = {
  "en-us": "English (US)", "en-uk": "English (UK)", "es": "Spanish",
  "de": "German", "fr": "French", "it-it": "Italian", "pt": "Portuguese",
  "nl": "Dutch", "pl": "Polish", "ru": "Russian", "zh-cn": "Chinese (Simplified)",
  "zh-tw": "Chinese (Traditional)", "ja": "Japanese", "ko": "Korean",
  "cs": "Czech", "he": "Hebrew",
};

const ALL_LOCALES = Object.keys(LOCALE_NAMES);

/**
 * TranslationsSection — renders locale-by-locale label inputs.
 * Saves each translation independently on blur.
 * Designed to live inside a dedicated "Translations" tab in a SlidePanel.
 */
export function TranslationsSection({ formKey, layoutKey }: {
  formKey: string;
  layoutKey: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const namespace = `form.${formKey}`;

  useEffect(() => {
    if (!formKey || !layoutKey) return;
    fetch(`/api/translations/inline?namespace=${encodeURIComponent(namespace)}&key=${encodeURIComponent(layoutKey)}`)
      .then(r => r.json())
      .then(data => setValues(data || {}))
      .catch(() => {});
  }, [formKey, layoutKey, namespace]);

  const handleBlur = async (locale: string, value: string) => {
    setSaving(s => ({ ...s, [locale]: true }));
    try {
      await fetch("/api/translations/inline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, namespace, key: layoutKey, value }),
      });
    } catch { /* silent */ } finally {
      setSaving(s => ({ ...s, [locale]: false }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {ALL_LOCALES.map(locale => (
        <Field key={locale} label={LOCALE_NAMES[locale]}>
          <div style={{ position: "relative" }}>
            <Input
              value={values[locale] ?? ""}
              onChange={v => setValues(prev => ({ ...prev, [locale]: v }))}
              onBlur={() => handleBlur(locale, values[locale] ?? "")}
              placeholder={`${LOCALE_NAMES[locale]} label…`}
            />
            {saving[locale] && (
              <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)" }}>
                saving…
              </span>
            )}
          </div>
        </Field>
      ))}
    </div>
  );
}
