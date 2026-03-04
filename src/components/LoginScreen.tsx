"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "@/context/SessionContext";

export default function LoginScreen() {
  const { login } = useSession();
  const [userId, setUserId] = useState("frank");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userRef.current?.focus();
    userRef.current?.select();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(userId, password);
    setLoading(false);
    if (!result.ok) setError(result.error || "Login failed");
  }

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
          backdrop-filter: blur(6px);
          background: rgba(255,255,255,0.85) !important;
        }
        .login-card {
          width: 100%;
          max-width: 380px;
          background: var(--bg-surface);
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
        .login-btn:hover:not(:disabled) {
          background: var(--accent-hover);
        }
        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .login-error {
          background: var(--danger-bg);
          color: var(--danger-text);
          border: 1px solid var(--danger-border);
          border-radius: 4px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  );
}
