"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Section, Field, Input } from "@/components/ui";
import { Icon } from "@/components/icons/Icon";
import { useSession } from "@/context/SessionContext";
import { useT } from "@/context/TranslationContext";

type ProfileData = Record<string, any>;

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileDialog({ open, onClose }: ProfileDialogProps) {
  const { user } = useSession();
  const t = useT();
  const [data, setData] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [photoVer, setPhotoVer] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load user record when dialog opens
  useEffect(() => {
    if (!open || !user.oid) return;
    setMessage("");
    setData(null);
    fetch(`/api/users?oid=${encodeURIComponent(user.oid)}&limit=1`)
      .then(r => r.json())
      .then(d => { if (d.rows?.[0]) setData(d.rows[0]); })
      .catch(() => {});
  }, [open, user.oid]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

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
        setMessage(t("crud.saved", "Saved"));
        setTimeout(() => onClose(), 600);
      } else {
        const err = await res.json();
        setMessage(err.error || t("crud.save_failed", "Save failed"));
      }
    } catch (e: any) {
      setMessage(e.message || t("crud.save_failed", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data?.oid) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("oid", data.oid);
      const res = await fetch("/api/users/photo", { method: "POST", body: form });
      if (res.ok) {
        setPhotoVer(v => v + 1);
      } else {
        const err = await res.json();
        setMessage(err.error || t("crud.upload_failed", "Upload failed"));
      }
    } catch {
      setMessage(t("crud.upload_failed", "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePhotoRemove = async () => {
    if (!data?.oid) return;
    setUploading(true);
    try {
      const res = await fetch("/api/users/photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oid: data.oid }),
      });
      if (res.ok) setPhotoVer(v => v + 1);
    } catch { /* */ }
    finally { setUploading(false); }
  };

  if (!open) return null;

  const photoSrc = data?.oid ? `/api/users/photo?oid=${data.oid}&v=${photoVer}&t=${Date.now()}` : "";
  const initials = data?.full_name
    ? data.full_name.split(/\s+/).map((p: string) => p[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("")
    : "??";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 900,
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)", zIndex: 901,
          width: "min(520px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,.2)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("shell.my_profile", "My Profile")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
          {!data ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>{t("crud.loading", "Loading…")}</div>
          ) : (
            <>
              {/* Photo + User ID header */}
              <div className="flex items-center gap-4 pb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {data.full_name || data.user_id}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {data.user_id}
                  </div>
                  {data.email && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {data.email}
                    </div>
                  )}
                </div>
                {/* Photo */}
                <div className="relative group flex-shrink-0">
                  <PhotoAvatar src={photoSrc} initials={initials} size={90} />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <div
                    className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    style={{ background: "rgba(0,0,0,0.45)" }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Icon name="camera" size={20} style={{ color: "#fff" }} />
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.6)" }}>
                      <span className="text-xs font-medium">…</span>
                    </div>
                  )}
                </div>
              </div>

              <Section title={t("users.section_identity", "Personal Information")}>
                <Field label={t("users.field.full_name", "Full Name")}>
                  <Input value={data.full_name || ""} onChange={v => onChange("full_name", v)} />
                </Field>
                <Field label={t("users.field.email", "Email")}>
                  <Input value={data.email || ""} readOnly />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("users.field.title", "Title")}>
                    <Input value={data.title || ""} onChange={v => onChange("title", v)} />
                  </Field>
                  <Field label={t("users.field.company", "Company")}>
                    <Input value={data.company || ""} onChange={v => onChange("company", v)} />
                  </Field>
                </div>
              </Section>

              <Section title={t("users.section_contact", "Contact")}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("users.field.phone", "Phone")}>
                    <Input value={data.phone || ""} onChange={v => onChange("phone", v)} />
                  </Field>
                  <Field label={t("users.field.cell_phone", "Cell Phone")}>
                    <Input value={data.cell_phone || ""} onChange={v => onChange("cell_phone", v)} />
                  </Field>
                </div>
              </Section>

              <Section title={t("global.section_address", "Address")}>
                <Field label={t("users.field.street1", "Street 1")}>
                  <Input value={data.street1 || ""} onChange={v => onChange("street1", v)} />
                </Field>
                <Field label={t("users.field.street2", "Street 2")}>
                  <Input value={data.street2 || ""} onChange={v => onChange("street2", v)} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label={t("users.field.city", "City")}>
                    <Input value={data.city || ""} onChange={v => onChange("city", v)} />
                  </Field>
                  <Field label={t("users.field.state", "State")}>
                    <Input value={data.state || ""} onChange={v => onChange("state", v)} />
                  </Field>
                  <Field label={t("users.field.postal_code", "Postal Code")}>
                    <Input value={data.postal_code || ""} onChange={v => onChange("postal_code", v)} />
                  </Field>
                </div>
                <Field label={t("users.field.country", "Country")}>
                  <Input value={data.country || ""} onChange={v => onChange("country", v)} />
                </Field>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div
            className="flex items-center justify-end gap-3 px-5 py-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {message && (
              <span className="text-xs mr-auto" style={{
                color: message === t("crud.saved", "Saved") ? "var(--success-text, #22c55e)" : "var(--danger-text)",
              }}>
                {message}
              </span>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {t("crud.cancel", "Cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-md text-xs font-semibold transition-colors"
              style={{
                background: "var(--accent)",
                color: "var(--accent-text)",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? t("crud.saving", "Saving…") : t("crud.save", "Save")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** Photo avatar with fallback to initials */
function PhotoAvatar({ src, initials, size }: { src: string; initials: string; size: number }) {
  const [error, setError] = useState(false);
  // Reset error when src changes (new upload)
  useEffect(() => { setError(false); }, [src]);

  if (!src || error) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-semibold"
        style={{
          width: size, height: size,
          background: "var(--accent)", color: "var(--accent-text)",
          fontSize: size * 0.32,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Profile photo"
      onError={() => setError(true)}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
