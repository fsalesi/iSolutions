"use client";
/**
 * EmailInput — Email address input with validation.
 *
 * Single mode: one email, validated on blur
 * Multi mode:  comma/semicolon/Enter to add chips, backspace to remove
 */
import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { useT } from "@/context/TranslationContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailInputProps {
  value: string;
  onChange: (v: string) => void;
  multiple?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

export function EmailInput({
  value,
  onChange,
  multiple = false,
  readOnly = false,
  disabled = false,
  placeholder,
  required = false,
}: EmailInputProps) {
  const t = useT();
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Multi: value is semicolon-separated
  const emails = multiple && value ? value.split(";").map(s => s.trim()).filter(Boolean) : [];

  const validateAndSet = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setError("");
      onChange("");
      return;
    }
    if (EMAIL_RE.test(trimmed)) {
      setError("");
      onChange(trimmed);
    } else {
      setError(t("validation.invalid_email", "Invalid email address"));
    }
  }, [onChange]);

  const addEmail = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (!EMAIL_RE.test(trimmed)) {
      setError(t("validation.invalid_email", "Invalid email address"));
      return;
    }
    // Deduplicate
    if (emails.some(e => e.toLowerCase() === trimmed.toLowerCase())) {
      setInputText("");
      setError("");
      return;
    }
    setError("");
    const updated = [...emails, trimmed].join("; ");
    onChange(updated);
    setInputText("");
  }, [emails, onChange]);

  const removeEmail = useCallback((idx: number) => {
    if (readOnly || disabled) return;
    const updated = emails.filter((_, i) => i !== idx).join("; ");
    onChange(updated);
  }, [emails, onChange, readOnly, disabled]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (multiple) {
      if (e.key === "Enter" || e.key === "," || e.key === ";") {
        e.preventDefault();
        addEmail(inputText);
      } else if (e.key === "Backspace" && !inputText && emails.length > 0) {
        removeEmail(emails.length - 1);
      }
    }
  }, [multiple, inputText, emails, addEmail, removeEmail]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    if (multiple) {
      if (inputText.trim()) addEmail(inputText);
    } else {
      validateAndSet(value);
    }
  }, [multiple, inputText, value, addEmail, validateAndSet]);

  const borderColor = error
    ? "var(--danger-text)"
    : focused
      ? "var(--border-focus)"
      : readOnly ? "var(--input-border-ro)" : "var(--input-border)";

  // ── Single mode ──
  if (!multiple) {
    return (
      <div>
        <input
          ref={inputRef}
          type="email"
          value={value ?? ""}
          placeholder={placeholder ?? "email@example.com"}
          readOnly={readOnly}
          disabled={disabled}
          required={required}
          onChange={e => { setError(""); onChange(e.target.value); }}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          className="w-full px-3 py-2 text-sm rounded-lg transition-all outline-none"
          style={{
            background: readOnly ? "var(--input-bg-ro)" : "var(--input-bg)",
            border: `1px solid ${borderColor}`,
            boxShadow: focused && !error ? "0 0 0 3px var(--ring-focus)" : error ? "0 0 0 3px rgba(220,53,69,0.15)" : "none",
            color: readOnly ? "var(--text-secondary)" : "var(--text-primary)",
            cursor: readOnly ? "default" : undefined,
          }}
        />
        {error && <div className="text-xs mt-1" style={{ color: "var(--danger-text)" }}>{error}</div>}
      </div>
    );
  }

  // ── Multi mode ──
  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-all cursor-text"
        style={{
          background: readOnly ? "var(--input-bg-ro)" : "var(--input-bg)",
          border: `1px solid ${borderColor}`,
          boxShadow: focused && !error ? "0 0 0 3px var(--ring-focus)" : error ? "0 0 0 3px rgba(220,53,69,0.15)" : "none",
          minHeight: 34,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            style={{
              background: "var(--bg-surface-alt)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-light)",
            }}
          >
            {email}
            {!readOnly && !disabled && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeEmail(i); }}
                className="hover:opacity-70 leading-none"
                style={{ color: "var(--text-muted)", fontSize: 14 }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!readOnly && !disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            placeholder={emails.length === 0 ? (placeholder ?? "Add email addresses...") : ""}
            onChange={e => { setError(""); setInputText(e.target.value); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            className="flex-1 min-w-[120px] outline-none bg-transparent text-sm py-0.5"
            style={{ color: "var(--text-primary)" }}
          />
        )}
      </div>
      {error && <div className="text-xs mt-1" style={{ color: "var(--danger-text)" }}>{error}</div>}
    </div>
  );
}
