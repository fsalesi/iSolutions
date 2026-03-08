"use client";
/**
 * NumberInput — Locale-aware numeric input.
 * Shows formatted value when unfocused, raw editable value when focused.
 * Parses locale-formatted input back to plain number on blur.
 */
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "@/context/TranslationContext";
import { formatNumber, parseNumber } from "./number-utils";

interface NumberInputProps {
  value: string | number;
  onChange: (raw: string) => void;
  scale?: number;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function NumberInput({
  value,
  onChange,
  scale = 0,
  readOnly,
  disabled,
  placeholder,
  className = "",
  style,
}: NumberInputProps) {
  const { locale } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = editing ? editText : formatNumber(value, locale, scale);

  const handleFocus = useCallback(() => {
    if (readOnly || disabled) return;
    setEditing(true);
    // Show the raw number (no grouping) for easy editing
    const raw = typeof value === "string" ? value : String(value);
    const n = parseFloat(raw);
    setEditText(isNaN(n) ? "" : n.toFixed(scale));
  }, [value, readOnly, disabled, scale]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (editText.trim()) {
      const parsed = parseNumber(editText, locale);
      if (parsed !== "") {
        onChange(parsed);
      }
    } else {
      onChange("");
    }
    setEditText("");
  }, [editText, locale, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setEditing(false);
      setEditText("");
    }
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
      onChange={e => {
        // Allow only digits, decimal separators, minus, and empty
        const v = e.target.value;
        if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) {
          setEditText(v);
        }
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`w-full px-3 py-2 text-sm rounded-lg transition-all outline-none ${className}`}
      style={{
        background: readOnly ? "var(--input-bg-ro)" : "var(--input-bg)",
        border: `1px solid ${readOnly ? "var(--input-border-ro)" : "var(--input-border)"}`,
        color: readOnly ? "var(--text-secondary)" : "var(--text-primary)",
        cursor: readOnly ? "default" : undefined,
        ...style,
      }}
      onFocusCapture={e => {
        if (!readOnly) {
          e.currentTarget.style.borderColor = "var(--border-focus)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--ring-focus)";
        }
      }}
      onBlurCapture={e => {
        e.currentTarget.style.borderColor = readOnly ? "var(--input-border-ro)" : "var(--input-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}
