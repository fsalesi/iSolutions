"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Section, Field, Input } from "@/components/ui";
import { useSession } from "@/context/SessionContext";
import { useT } from "@/context/TranslationContext";

type ProfileData = Record<string, any>;

export default function Profile({ activeNav, onNavigate }: {
  activeNav: string;
  onNavigate: (k: string, oid?: string) => void;
}) {
  const t = useT();
  const { user } = useSession();
  const [data, setData] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Load current user's record by OID from session
  useEffect(() => {
    if (!user.oid) return;
    fetch(`/api/users?oid=${encodeURIComponent(user.oid)}&limit=1`)
      .then(r => r.json())
      .then(d => {
        if (d.rows?.[0]) setData(d.rows[0]);
      })
      .catch(() => {});
  }, [user.oid]);

  const onChange = useCallback((field: string, value: any) => {
    setData(prev => prev ? { ...prev, [field]: value } : prev);
    setMessage("");
  }, []);

  const handleSave = async () => {
    if (!data?.oid) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setMessage("Profile saved.");
      } else {
        const err = await res.json();
        setMessage(err.error || "Save failed");
      }
    } catch (e: any) {
      setMessage(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <AppShell title={t("profile.title", "My Profile")} activeNav={activeNav} onNavigate={onNavigate}>
        <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("profile.title", "My Profile")} activeNav={activeNav} onNavigate={onNavigate}>
      <div className="overflow-y-auto h-full">
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">

          <Section title={t("profile.section_personal", "Personal Information")}>
            <Field label={t("profile.full_name", "Full Name")}>
              <Input value={data.full_name || ""} onChange={v => onChange("full_name", v)} />
            </Field>
            <Field label={t("profile.email", "Email")}>
              <Input value={data.email || ""} onChange={v => onChange("email", v)} />
            </Field>
            <Field label={t("profile.title_field", "Title")}>
              <Input value={data.title || ""} onChange={v => onChange("title", v)} />
            </Field>
            <Field label={t("profile.company", "Company")}>
              <Input value={data.company || ""} onChange={v => onChange("company", v)} />
            </Field>
          </Section>

          <Section title={t("profile.section_contact", "Contact")}>
            <Field label={t("profile.phone", "Phone")}>
              <Input value={data.phone || ""} onChange={v => onChange("phone", v)} />
            </Field>
            <Field label={t("profile.cell_phone", "Cell Phone")}>
              <Input value={data.cell_phone || ""} onChange={v => onChange("cell_phone", v)} />
            </Field>
          </Section>

          <Section title={t("profile.section_address", "Address")}>
            <Field label={t("profile.street1", "Street 1")}>
              <Input value={data.street1 || ""} onChange={v => onChange("street1", v)} />
            </Field>
            <Field label={t("profile.street2", "Street 2")}>
              <Input value={data.street2 || ""} onChange={v => onChange("street2", v)} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("profile.city", "City")}>
                <Input value={data.city || ""} onChange={v => onChange("city", v)} />
              </Field>
              <Field label={t("profile.state", "State")}>
                <Input value={data.state || ""} onChange={v => onChange("state", v)} />
              </Field>
              <Field label={t("profile.postal_code", "Postal Code")}>
                <Input value={data.postal_code || ""} onChange={v => onChange("postal_code", v)} />
              </Field>
            </div>
            <Field label={t("profile.country", "Country")}>
              <Input value={data.country || ""} onChange={v => onChange("country", v)} />
            </Field>
          </Section>

          {/* Save bar */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-md text-xs font-semibold transition-colors"
              style={{
                background: "var(--accent)",
                color: "var(--accent-text)",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {message && (
              <span className="text-xs" style={{
                color: message === "Profile saved." ? "var(--success-text, #22c55e)" : "var(--danger-text)",
              }}>
                {message}
              </span>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  );
}
