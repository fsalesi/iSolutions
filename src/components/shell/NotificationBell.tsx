"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";

type Notification = {
  id: number;
  note_id: number;
  table_name: string;
  record_oid: string;
  is_read: boolean;
  created_at: string;
  note_body: string;
  note_author: string;
  author_name: string;
};

interface NotificationBellProps {
  onNavigate?: (navKey: string, recordOid?: string) => void;
}

function formatTime(iso: string, t: (key: string, fb?: string, p?: Record<string, string | number>) => string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return t("shell.just_now", "just now");
  if (diff < 3600000) return t("shell.minutes_ago", "{n}m ago", { n: Math.floor(diff / 60000) });
  if (diff < 86400000) return t("shell.hours_ago", "{n}h ago", { n: Math.floor(diff / 3600000) });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function tableLabel(tableName: string) {
  return tableName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function truncate(text: string, maxLen: number) {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

/* ── Web Audio ding sound ────────────────────────────────────── */
function playDing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Two-tone chime: high note then slightly lower
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);        // A5
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.12); // E5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);

    // Cleanup
    osc.onended = () => { gain.disconnect(); ctx.close(); };
  } catch { /* audio not available */ }
}

/* ── CSS keyframes (injected once) ───────────────────────────── */
const STYLE_ID = "notif-bell-animations";
function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes bellSwing {
      0%   { transform: rotate(0deg); }
      15%  { transform: rotate(14deg); }
      30%  { transform: rotate(-12deg); }
      45%  { transform: rotate(8deg); }
      60%  { transform: rotate(-6deg); }
      75%  { transform: rotate(3deg); }
      100% { transform: rotate(0deg); }
    }
    @keyframes badgePop {
      0%   { transform: scale(0.3); opacity: 0; }
      50%  { transform: scale(1.3); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes badgePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
      50%      { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
    }
    .notif-bell-swing { animation: bellSwing 0.6s ease-in-out; }
    .notif-badge-pop  { animation: badgePop 0.3s ease-out, badgePulse 2s ease-in-out 0.3s 3; }
  `;
  document.head.appendChild(style);
}

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const [unread, setUnread] = useState(0);
  const t = useT();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [bellAnim, setBellAnim] = useState(false);
  const [badgeAnim, setBadgeAnim] = useState(false);
  const prevUnreadRef = useRef<number | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Inject CSS once
  useEffect(() => { ensureStyles(); }, []);

  /* ── fetch initial unread count ─────────────────────────────────── */
  useEffect(() => {
    fetch("/api/notifications/count")
      .then(r => r.json())
      .then(data => {
        const count = data.unread || 0;
        prevUnreadRef.current = count;
        setUnread(count);
      })
      .catch(() => {});
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=20");
      const data = await res.json();
      setNotifications(data.rows || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);


  /* ── SSE: real-time notification push ────────────────────────────── */
  useEffect(() => {
    const es = new EventSource("/api/events/stream");

    es.addEventListener("notification", () => {
      // A new notification arrived — bump the count and animate
      setUnread(prev => {
        const next = prev + 1;
        prevUnreadRef.current = next;
        return next;
      });
      playDing();
      setBellAnim(true);
      setBadgeAnim(true);
      setTimeout(() => setBellAnim(false), 700);
      setTimeout(() => setBadgeAnim(false), 6500);

      // If dropdown is open, refresh the list live
      setOpen(prev => {
        if (prev) fetchList();
        return prev;
      });
    });

    es.onerror = () => {
      // Browser auto-reconnects on error — nothing to do
    };

    return () => es.close();
  }, [fetchList]);


  /* ── fetch full list when dropdown opens ─────────────────── */
  useEffect(() => { if (open) fetchList(); }, [open, fetchList]);

  /* ── close on outside click ──────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* ── actions ─────────────────────────────────────────────── */
  const markRead = async (id: number) => {
    await fetch("/api/notifications/read", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const deleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id);
    setOpen(false);

    // Resolve table_name → form_key (e.g. "requisition" → "POReq")
    // Fall back to the raw table name if no form is found (hand-rolled pages handle their own keys)
    let navKey = n.table_name;
    try {
      const res = await fetch(`/api/forms/resolve?table=${encodeURIComponent(n.table_name)}`);
      const data = await res.json();
      if (data.form_key) navKey = data.form_key;
    } catch { /* ignore — fall back to table name */ }

    onNavigate?.(navKey, n.record_oid);
  };

  return (
    <div ref={dropRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className={bellAnim ? "notif-bell-swing" : ""}
        style={{
          background: "none", border: "none", cursor: "pointer",
          position: "relative", padding: 6, color: "var(--header-text-muted)",
          transformOrigin: "top center",
        }}
        title="Notifications"
      >
        <Icon name="bell" size={20} />
        {unread > 0 && (
          <span
            className={badgeAnim ? "notif-badge-pop" : ""}
            style={{
              position: "absolute", top: 2, right: 2,
              background: "#ef4444", color: "#fff",
              borderRadius: 10, minWidth: 16, height: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, padding: "0 4px",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 8,
          width: 380, maxHeight: 440, overflowY: "auto",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
              {t("shell.notifications", "Notifications")}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--accent)", fontSize: 12, fontWeight: 600,
                }}
              >
                {t("shell.mark_all_read", "Mark all read")}
              </button>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {t("crud.loading", "Loading…")}
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {t("shell.no_notifications", "No notifications")}
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: "10px 16px", cursor: "pointer",
                  borderBottom: "1px solid var(--border-light)",
                  borderLeft: n.is_read ? "3px solid transparent" : "3px solid var(--accent)",
                  background: n.is_read ? "transparent" : "var(--bg-surface-alt)",
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-selected)")}
                onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? "transparent" : "var(--bg-surface-alt)")}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4 }}>
                    {(() => {
                      const tpl = t("shell.mentioned_you_on", "{author} mentioned you on {page}");
                      const parts = tpl.split(/(\{author\}|\{page\})/);
                      return parts.map((p, i) =>
                        p === "{author}" ? <strong key={i}>{n.author_name}</strong> :
                        p === "{page}" ? <strong key={i}>{tableLabel(n.table_name)}</strong> :
                        <span key={i}>{p}</span>
                      );
                    })()}
                  </div>
                  <div style={{
                    fontSize: 12, color: "var(--text-muted)", marginTop: 2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {truncate(n.note_body, 80)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    {formatTime(n.created_at, t)}
                  </div>
                </div>
                <button
                  onClick={(e) => deleteNotification(n.id, e)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", padding: 2, flexShrink: 0,
                    opacity: 0.4, marginTop: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0.4")}
                  title="Remove"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
