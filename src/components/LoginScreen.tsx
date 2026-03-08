"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "@/context/SessionContext";

type SSOProvider = { id: string; label: string };

function ProviderIcon({ id }: { id: string }) {
  if (id === "microsoft") return (
    <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
  if (id === "google") return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
  if (id === "okta") return (
    <svg width="18" height="18" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="25" fill="#007DC1"/>
      <circle cx="25" cy="25" r="11.5" fill="white"/>
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

export default function LoginScreen() {
  const { login } = useSession();
  const [userId, setUserId]       = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [ssoReady, setSsoReady]   = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const ssoCheckDone = useRef(false);

  useEffect(() => {
    if (ssoCheckDone.current) return;
    ssoCheckDone.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.has("sso_error")) { setSsoReady(true); return; }

    fetch("/api/auth/sso-providers")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.autoRedirect && d?.provider) {
          window.location.href = `/api/auth/sso?provider=${d.provider}`;
        } else {
          if (d?.providers?.length) setProviders(d.providers);
          setSsoReady(true);
        }
      })
      .catch(() => setSsoReady(true));
  }, []);

  useEffect(() => {
    if (!ssoReady) return;
    userRef.current?.focus();
    const params = new URLSearchParams(window.location.search);
    const ssoErr = params.get("sso_error");
    if (ssoErr) {
      setError(decodeURIComponent(ssoErr));
      window.history.replaceState({}, "", "/");
    }
  }, [ssoReady]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(userId, password);
    setLoading(false);
    if (!result.ok) setError(result.error || "Login failed");
  }

  if (!ssoReady) return null;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-page, #f4f5f7)",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "360px",
        background: "var(--bg-card, #fff)",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: "8px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        padding: "2rem",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "48px",
            height: "48px",
            borderRadius: "10px",
            background: "var(--accent, #2563eb)",
            marginBottom: "0.875rem",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-primary, #1a202c)" }}>
            iSolutions
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)", margin: "0.25rem 0 0" }}>
            Enterprise Procurement Platform
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {error && (
            <div style={{
              background: "var(--danger-bg, #fef2f2)",
              color: "var(--danger-text, #dc2626)",
              border: "1px solid var(--danger-border, #fecaca)",
              borderRadius: "4px",
              padding: "0.5rem 0.75rem",
              fontSize: "0.8rem",
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <label htmlFor="userId" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary, #374151)" }}>
              User ID
            </label>
            <input
              ref={userRef}
              id="userId"
              type="text"
              autoComplete="username"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              style={{
                padding: "0.5rem 0.65rem",
                border: "1px solid var(--input-border, #d1d5db)",
                borderRadius: "4px",
                background: "var(--input-bg, #fff)",
                color: "var(--text-primary, #1a202c)",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <label htmlFor="password" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary, #374151)" }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                padding: "0.5rem 0.65rem",
                border: "1px solid var(--input-border, #d1d5db)",
                borderRadius: "4px",
                background: "var(--input-bg, #fff)",
                color: "var(--text-primary, #1a202c)",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.25rem",
              padding: "0.6rem 1rem",
              background: "var(--accent, #2563eb)",
              color: "var(--accent-text, #fff)",
              border: "none",
              borderRadius: "4px",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* SSO providers */}
        {providers.length > 0 && (
          <div style={{ marginTop: "1.25rem" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "0.875rem",
              color: "var(--text-muted, #64748b)",
              fontSize: "0.72rem",
            }}>
              <span style={{ flex: 1, height: "1px", background: "var(--border, #e2e8f0)" }} />
              or continue with
              <span style={{ flex: 1, height: "1px", background: "var(--border, #e2e8f0)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {providers.map(p => (
                <button
                  key={p.id}
                  onClick={() => { window.location.href = `/api/auth/sso?provider=${p.id}`; }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.6rem",
                    padding: "0.5rem 1rem",
                    background: "#fff",
                    color: "#333",
                    border: "1px solid #d0d5dd",
                    borderRadius: "4px",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <ProviderIcon id={p.id} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
