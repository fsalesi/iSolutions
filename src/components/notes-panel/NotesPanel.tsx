"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/context/SessionContext";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";

/* ── types ──────────────────────────────────────────────── */
type Attachment = { id: number; note_id: number; filename: string; mime_type: string; file_size: number };
type Mention = { user_id: string; full_name?: string };
type Note = {
  id: number; body: string; author: string; author_name: string; author_oid?: string; created_at: string;
  attachments: Attachment[]; mentions: Mention[];
};
type UserOption = { user_id: string; full_name: string };

interface NotesPanelProps {
  table: string;
  recordOid: string;
  open: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

/* ── helpers ──────────────────────────────────────────────── */
function formatTime(iso: string, t: (key: string, fb?: string, p?: Record<string, string | number>) => string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return t("shell.just_now", "just now");
  if (diff < 3600000) return t("shell.minutes_ago", "{n}m ago", { n: Math.floor(diff / 60000) });
  if (diff < 86400000) return t("shell.hours_ago", "{n}h ago", { n: Math.floor(diff / 3600000) });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function renderBody(body: string) {
  const parts = body.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} style={{ color: "var(--accent)", fontWeight: 600 }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function NoteAvatar({ oid, initial, isMine }: { oid?: string; initial: string; isMine: boolean }) {
  const [error, setError] = React.useState(false);
  const src = oid ? `/api/users/photo?oid=${oid}` : "";

  if (!src || error) {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: isMine ? "var(--accent)" : "var(--border)",
        color: isMine ? "#fff" : "var(--text-primary)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, marginTop: 2,
      }}>
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setError(true)}
      style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        objectFit: "cover", marginTop: 2,
      }}
    />
  );
}

function getInitial(name: string) {
  return (name || "?")[0].toUpperCase();
}

function isImage(mime: string) {
  return mime.startsWith("image/");
}

function isPdf(mime: string) {
  return mime === "application/pdf";
}

function isPreviewable(mime: string) {
  return isImage(mime) || isPdf(mime);
}

/* ── component ──────────────────────────────────────────── */
export function NotesPanel({ table, recordOid, open, onClose, onCountChange }: NotesPanelProps) {
  const t = useT();
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<UserOption[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  // TODO: get from real auth
  const { user: sessionUser } = useSession();
  const currentUser = sessionUser.userId;

  /* ── fetch notes ──────────────────────────────────────── */
  const fetchNotes = useCallback(async () => {
    if (!table || !recordOid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notes?table=${table}&oid=${recordOid}&limit=200`);
      const data = await res.json();
      setNotes(data.rows || []);
      setTotal(data.total || 0);
      onCountChange?.(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [table, recordOid, onCountChange]);

  useEffect(() => { if (open) fetchNotes(); }, [open, fetchNotes]);

  useEffect(() => {
    if (open && notes.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [open, notes.length]);

  /* ── @mention search ─────────────────────────────────── */
  useEffect(() => {
    if (mentionSearch === null) { setMentionUsers([]); return; }
    const q = mentionSearch;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?table=users&search=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        setMentionUsers((data.rows || []).map((u: any) => ({
          user_id: u.user_id, full_name: u.full_name || u.user_id,
        })));
        setMentionIdx(0);
      } catch { /* ignore */ }
    }, 150);
    return () => clearTimeout(timer);
  }, [mentionSearch]);

  /* ── handle text input with @ detection ──────────────── */
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const caret = e.target.selectionStart || 0;
    const before = val.slice(0, caret);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) { setMentionSearch(atMatch[1]); } else { setMentionSearch(null); }
  };

  const insertMention = (user: UserOption) => {
    const caret = textareaRef.current?.selectionStart || text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const atIdx = before.lastIndexOf("@");
    const newText = before.slice(0, atIdx) + "@" + user.user_id + " " + after;
    setText(newText);
    if (!selectedMentions.includes(user.user_id)) {
      setSelectedMentions([...selectedMentions, user.user_id]);
    }
    setMentionSearch(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionSearch !== null && mentionUsers.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionUsers.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionUsers[mentionIdx]); }
      else if (e.key === "Escape") { setMentionSearch(null); }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ── send note ─────────────────────────────────────────── */
  const handleSend = async () => {
    if (!text.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const mentionsInText = [...text.matchAll(/@(\w+)/g)].map(m => m[1]);
      const allMentions = [...new Set([...selectedMentions, ...mentionsInText])];

      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_name: table, record_oid: recordOid,
          body: text.trim(), mentions: allMentions,
        }),
      });
      if (!res.ok) throw new Error(t("notes.failed_create", "Failed to create note"));
      const note = await res.json();

      // Upload pending files
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("note_id", String(note.id));
        fd.append("file", file);
        await fetch("/api/notes/attachments", { method: "POST", body: fd });
      }

      setText("");
      setPendingFiles([]);
      setSelectedMentions([]);
      fetchNotes();
    } catch (err) {
      console.error(t("notes.failed_send", "Failed to send note"), err);
    }
    setSending(false);
  };

  /* ── delete note (two-step confirm) ───────────────────── */
  const requestDelete = (id: number) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDelete(id);
    confirmTimerRef.current = setTimeout(() => setConfirmingDelete(null), 3000);
  };

  const confirmDelete = async (id: number) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDelete(null);
    await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
    fetchNotes();
  };

  const cancelDelete = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDelete(null);
  };

  /* ── edit note ───────────────────────────────────────── */
  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditText(note.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    try {
      await fetch(`/api/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, body: editText }),
      });
      setEditingId(null);
      setEditText("");
      fetchNotes();
    } catch (err) {
      console.error(t("notes.failed_edit", "Failed to edit note"), err);
    }
  };

  /* ── delete attachment ────────────────────────────────── */
  const deleteAttachment = async (attId: number) => {
    try {
      await fetch(`/api/notes/attachments?id=${attId}`, { method: "DELETE" });
      fetchNotes();
    } catch (err) {
      console.error(t("notes.failed_delete_attachment", "Failed to delete attachment"), err);
    }
  };

  /* ── file handling ─────────────────────────────────────── */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  /* ── drag & drop ───────────────────────────────────────── */
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCountRef.current++;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) setDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCountRef.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      setPendingFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  if (!open) return null;

  return (
    <>
      <style>{`
        [style*="position: relative"]:hover .att-del,
        [style*="inline-flex"]:hover .att-del-inline { opacity: 1 !important; }
      `}</style>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 998,
          background: "rgba(0,0,0,0.3)",
        }}
      />

      {/* Panel */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(480px, 100vw)", zIndex: 999,
          background: "var(--bg-surface)", borderLeft: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
        }}
      >

        {/* Drag overlay */}
        {dragging && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            background: "rgba(var(--accent-rgb, 99,102,241), 0.08)",
            border: "3px dashed var(--accent)",
            borderRadius: 12, margin: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 8,
            pointerEvents: "none",
          }}>
            <Icon name="upload" size={36} />
            <span style={{ fontWeight: 600, fontSize: 15, color: "var(--accent)" }}>
              {t("notes.drop_files", "Drop files to attach")}
            </span>
          </div>
        )}

        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--bg-surface-alt)",
        }}>
          <Icon name="messageSquare" size={20} />
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1, color: "var(--text-primary)" }}>
            {t("notes.title", "Notes")}
          </span>
          {total > 0 && (
            <span style={{
              background: "var(--accent)", color: "#fff", borderRadius: 10,
              padding: "2px 8px", fontSize: 12, fontWeight: 600,
            }}>{total}</span>
          )}
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", padding: 4,
          }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading && notes.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 14 }}>
              {t("crud.loading", "Loading…")}
            </div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
              <Icon name="messageSquare" size={40} />
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 500 }}>{t("notes.no_notes", "No notes yet")}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{t("notes.start_conversation", "Start the conversation below")}</div>
            </div>
          ) : (
            notes.map((note) => {
              const isMine = note.author === currentUser;
              return (
                <div
                  key={note.id}
                  style={{
                    marginBottom: 16, display: "flex", gap: 10,
                    flexDirection: isMine ? "row-reverse" : "row",
                  }}
                >
                  {/* Avatar */}
                  <NoteAvatar
                    oid={note.author_oid}
                    initial={getInitial(note.author_name)}
                    isMine={isMine}
                  />

                  {/* Bubble */}
                  <div style={{ maxWidth: "75%", minWidth: 0 }}>
                    <div style={{
                      display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2,
                      flexDirection: isMine ? "row-reverse" : "row",
                    }}>
                      {!isMine && (
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                          {note.author_name}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {formatTime(note.created_at, t)}
                      </span>
                      {isMine && editingId !== note.id && (
                        <>
                          <button
                            onClick={() => startEdit(note)}
                            title="Edit"
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "var(--text-muted)", padding: "0 2px",
                              opacity: 0.5, fontSize: 0,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          {confirmingDelete === note.id ? (
                            <>
                              <button
                                onClick={() => confirmDelete(note.id)}
                                title={t("crud.delete", "Delete")}
                                style={{
                                  background: "none", border: "none", cursor: "pointer",
                                  color: "var(--danger-text, #ef4444)", padding: "0 2px",
                                  fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 2,
                                }}
                              >
                                <Icon name="check" size={13} />
                              </button>
                              <button
                                onClick={cancelDelete}
                                title={t("crud.cancel", "Cancel")}
                                style={{
                                  background: "none", border: "none", cursor: "pointer",
                                  color: "var(--text-muted)", padding: "0 2px",
                                  fontSize: 0,
                                }}
                              >
                                <Icon name="x" size={13} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => requestDelete(note.id)}
                              title={t("crud.delete", "Delete")}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--text-muted)", padding: "0 2px",
                                opacity: 0.5, fontSize: 0,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                              onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {editingId === note.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                          rows={2}
                          style={{
                            resize: "none", border: "1px solid var(--accent)",
                            borderRadius: 8, padding: "8px 12px", fontSize: 14, fontFamily: "inherit",
                            background: "var(--bg-main)", color: "var(--text-primary)",
                            outline: "none", minHeight: 38, maxHeight: 120, overflow: "auto",
                          }}
                          onInput={e => {
                            const el = e.currentTarget;
                            el.style.height = "auto";
                            el.style.height = Math.min(el.scrollHeight, 120) + "px";
                          }}
                        />
                        <div style={{ display: "flex", gap: 6, justifyContent: isMine ? "flex-end" : "flex-start" }}>
                          <button onClick={cancelEdit} style={{
                            background: "none", border: "1px solid var(--border)", borderRadius: 6,
                            padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--text-secondary)",
                          }}>{t("crud.cancel", "Cancel")}</button>
                          <button onClick={saveEdit} style={{
                            background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6,
                            padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600,
                          }}>{t("crud.save", "Save")}</button>
                        </div>
                      </div>
                    ) : note.body.trim() ? (
                      <div style={{
                        background: isMine ? "var(--accent)" : "var(--bg-surface-alt)",
                        color: isMine ? "#fff" : "var(--text-primary)",
                        borderRadius: isMine ? "10px 0 10px 10px" : "0 10px 10px 10px",
                        padding: "8px 12px", fontSize: 14, lineHeight: 1.5,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {isMine ? note.body : renderBody(note.body)}
                      </div>
                    ) : null}

                    {/* Attachments */}
                    {note.attachments.length > 0 && (
                      <div style={{
                        display: "flex", flexDirection: "column", gap: 6, marginTop: 6,
                        alignItems: isMine ? "flex-end" : "flex-start",
                      }}>
                        {/* Image previews */}
                        {note.attachments.filter(a => isImage(a.mime_type)).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {note.attachments.filter(a => isImage(a.mime_type)).map(att => (
                              <div key={att.id} style={{ position: "relative", display: "inline-block" }}>
                                <a
                                  href={`/api/notes/attachments?id=${att.id}`}
                                  target="_blank"
                                  rel="noopener"
                                  style={{ display: "block", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}
                                >
                                  <img
                                    src={`/api/notes/attachments?id=${att.id}`}
                                    alt={att.filename}
                                    style={{
                                      maxWidth: 220, maxHeight: 180,
                                      display: "block", objectFit: "cover",
                                      cursor: "pointer",
                                    }}
                                  />
                                </a>
                                {isMine && (
                                  <button
                                    onClick={(e) => { e.preventDefault(); deleteAttachment(att.id); }}
                                    title="Remove"
                                    className="att-del"
                                    style={{
                                      position: "absolute", top: 4, right: 4,
                                      width: 18, height: 18, borderRadius: "50%",
                                      background: "rgba(0,0,0,0.45)", color: "#fff",
                                      border: "none", cursor: "pointer", padding: 0,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 0, opacity: 0, transition: "opacity 0.15s",
                                    }}
                                  >
                                    <Icon name="x" size={10} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* PDF previews */}
                        {note.attachments.filter(a => isPdf(a.mime_type)).map(att => (
                          <div key={att.id} style={{ position: "relative", maxWidth: 220 }}>
                            <a
                              href={`/api/notes/attachments?id=${att.id}`}
                              target="_blank"
                              rel="noopener"
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "8px 12px", borderRadius: 8, fontSize: 13,
                                background: "var(--bg-main)", border: "1px solid var(--border)",
                                color: "var(--text-primary)", textDecoration: "none",
                              }}
                            >
                              <span style={{ fontSize: 24, lineHeight: 1 }}>📄</span>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {att.filename}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatSize(att.file_size)}</div>
                              </div>
                            </a>
                            {isMine && (
                              <button
                                onClick={() => deleteAttachment(att.id)}
                                title="Remove"
                                className="att-del"
                                style={{
                                  position: "absolute", top: 4, right: 4,
                                  width: 18, height: 18, borderRadius: "50%",
                                  background: "rgba(0,0,0,0.45)", color: "#fff",
                                  border: "none", cursor: "pointer", padding: 0,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 0, opacity: 0, transition: "opacity 0.15s",
                                }}
                              >
                                <Icon name="x" size={10} />
                              </button>
                            )}
                          </div>
                        ))}
                        {/* Other files — download chips */}
                        {note.attachments.filter(a => !isPreviewable(a.mime_type)).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {note.attachments.filter(a => !isPreviewable(a.mime_type)).map(att => (
                              <div key={att.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <a
                                  href={`/api/notes/attachments?id=${att.id}`}
                                  target="_blank"
                                  rel="noopener"
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "4px 10px", borderRadius: 6, fontSize: 12,
                                    background: "var(--bg-main)", border: "1px solid var(--border)",
                                    color: "var(--accent)", textDecoration: "none",
                                  }}
                                >
                                  <Icon name="download" size={12} />
                                  <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {att.filename}
                                  </span>
                                  <span style={{ color: "var(--text-muted)" }}>({formatSize(att.file_size)})</span>
                                </a>
                                {isMine && (
                                  <button
                                    onClick={() => deleteAttachment(att.id)}
                                    title="Remove"
                                    className="att-del-inline"
                                    style={{
                                      background: "none", border: "none", cursor: "pointer",
                                      color: "var(--text-muted)", padding: "0 2px",
                                      opacity: 0, fontSize: 0, transition: "opacity 0.15s",
                                    }}
                                  >
                                    <Icon name="x" size={11} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Compose area */}
        <div style={{
          borderTop: "1px solid var(--border)", padding: "12px 16px",
          background: "var(--bg-surface)",
        }}>
          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {pendingFiles.map((f, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "3px 8px", borderRadius: 6, fontSize: 12,
                  background: "var(--bg-surface-alt)", border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}>
                  <Icon name="upload" size={11} />
                  <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    ({formatSize(f.size)})
                  </span>
                  <button onClick={() => removePendingFile(i)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", padding: 0, fontSize: 0,
                  }}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{ position: "relative" }}>
            {/* @mention dropdown */}
            {mentionSearch !== null && mentionUsers.length > 0 && (
              <div style={{
                position: "absolute", bottom: "100%", left: 0, right: 0,
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: 8, boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
                maxHeight: 200, overflowY: "auto", marginBottom: 4, zIndex: 10,
              }}>
                {mentionUsers.map((u, i) => (
                  <div
                    key={u.user_id}
                    onClick={() => insertMention(u)}
                    style={{
                      padding: "8px 12px", cursor: "pointer", fontSize: 13,
                      background: i === mentionIdx ? "var(--bg-selected)" : "transparent",
                      color: "var(--text-primary)",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                    onMouseEnter={() => setMentionIdx(i)}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: "var(--accent)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {getInitial(u.full_name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{u.user_id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", padding: "6px 2px", flexShrink: 0,
                }}
                title={t("notes.attach_files", "Attach files")}
              >
                <Icon name="upload" size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />

              {/* Text area */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder={t("notes.placeholder", "Type a note... Use @ to mention")}
                rows={1}
                style={{
                  flex: 1, resize: "none", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 12px", fontSize: 14, fontFamily: "inherit",
                  background: "var(--bg-main)", color: "var(--text-primary)",
                  outline: "none", minHeight: 38, maxHeight: 120,
                  overflow: "auto",
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
              />

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={sending || (!text.trim() && pendingFiles.length === 0)}
                style={{
                  background: "var(--accent)", color: "#fff", border: "none",
                  borderRadius: 8, padding: "8px 12px", cursor: "pointer",
                  opacity: sending || (!text.trim() && pendingFiles.length === 0) ? 0.4 : 1,
                  flexShrink: 0, fontWeight: 600, fontSize: 13,
                }}
              >
                {t("notes.send", "Send")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
