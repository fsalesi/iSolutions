"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "@/context/SessionContext";

type SSOProvider = { id: string; label: string };

// SVG logos for each provider
function ProviderIcon({ id }: { id: string }) {
  if (id === "microsoft") return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
  if (id === "google") return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
  if (id === "okta") return (
    <svg width="20" height="20" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="25" fill="#007DC1"/>
      <circle cx="25" cy="25" r="11.5" fill="white"/>
    </svg>
  );
  // Generic fallback
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

export default function LoginScreen() {
  const { login } = useSession();
  const [userId, setUserId]       = useState("frank");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const userRef = useRef<HTMLInputElement>(null);

  const ssoCheckDone = useRef(false);
  const [ssoReady, setSsoReady] = useState(false);

  // Check SSO before showing anything — render null until resolved to avoid blink
  useEffect(() => {
    if (ssoCheckDone.current) return; // StrictMode double-invoke guard
    ssoCheckDone.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.has("sso_error")) { setSsoReady(true); return; }

    fetch("/api/auth/sso-providers")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.autoRedirect && d?.provider) {
          window.location.href = `/api/auth/sso?provider=${d.provider}`;
          // don't set ssoReady — stay blank while redirecting
        } else {
          if (d?.providers?.length) setProviders(d.providers);
          setSsoReady(true);
        }
      })
      .catch(() => setSsoReady(true));
  }, []);

  useEffect(() => {
    userRef.current?.focus();
    userRef.current?.select();

    // Show any SSO error that came back via redirect
    const params = new URLSearchParams(window.location.search);
    const ssoErr = params.get("sso_error");
    if (ssoErr) {
      setError(decodeURIComponent(ssoErr));
      window.history.replaceState({}, "", "/");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(userId, password);
    setLoading(false);
    if (!result.ok) setError(result.error || "Login failed");
  }

  function handleSSO(providerId: string) {
    window.location.href = `/api/auth/sso?provider=${providerId}`;
  }

  if (!ssoReady) return null;

  return (
    <div className="login-backdrop">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">iSolutions</h1>
          <p className="login-subtitle">Enterprise Procurement Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label htmlFor="userId">User ID</label>
            <input
              ref={userRef}
              id="userId"
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading || !userId.trim()}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {providers.length > 0 && (
          <div className="sso-section">
            <div className="sso-divider">
              <span>or sign in with</span>
            </div>
            <div className="sso-buttons">
              {providers.map(p => (
                <button key={p.id} className="sso-btn" onClick={() => handleSSO(p.id)}>
                  <ProviderIcon id={p.id} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .login-backdrop {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: url('/login-bg.png') center center / cover no-repeat;
        }
        .login-card {
          width: 100%;
          max-width: 380px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(6px);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: var(--shadow-md);
          padding: 2rem;
        }
        .login-header {
          text-align: center;
          margin-bottom: 1.75rem;
        }
        .login-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent);
          margin: 0 0 0.25rem;
        }
        .login-subtitle {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin: 0;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .login-field {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .login-field label {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .login-field input {
          padding: 0.5rem 0.65rem;
          border: 1px solid var(--input-border);
          border-radius: 4px;
          background: var(--input-bg);
          color: var(--text-primary);
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .login-field input:focus {
          border-color: var(--border-focus);
        }
        .login-btn {
          margin-top: 0.5rem;
          padding: 0.55rem 1rem;
          background: var(--accent);
          color: var(--accent-text);
          border: none;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .login-btn:hover:not(:disabled) { background: var(--accent-hover); }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .login-error {
          background: var(--danger-bg);
          color: var(--danger-text);
          border: 1px solid var(--danger-border);
          border-radius: 4px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8rem;
        }
        .sso-section { margin-top: 1.25rem; }
        .sso-divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          color: var(--text-muted);
          font-size: 0.75rem;
        }
        .sso-divider::before,
        .sso-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .sso-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sso-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          padding: 0.5rem 1rem;
          background: white;
          color: #333;
          border: 1px solid #d0d5dd;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .sso-btn:hover {
          background: #f9fafb;
          border-color: #aab0bb;
        }
      `}</style>
    </div>
  );
}
