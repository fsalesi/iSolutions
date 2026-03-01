"use client";
/**
 * DatePicker — Main date/datetime/range picker component.
 * All phases: single date, datetime, range, presets.
 * Zero external dependencies — native Date + Intl only.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "@/context/TranslationContext";
import { DatePickerCalendar } from "./DatePickerCalendar";
import { DatePickerTime } from "./DatePickerTime";
import { DatePickerPresets } from "./DatePickerPresets";
import {
  formatDate, formatTime, parseDate, parseDateTime, isDateDisabled,
  getDatePlaceholder, getDateTimePlaceholder, getDefaultPresets,
  type Preset,
} from "./date-utils";

// ── Calendar SVG icon (inline to avoid adding to Icon registry) ────
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ── Props ──────────────────────────────────────────────────────────
interface DatePickerProps {
  value: string | null;
  onChange: (iso: string | null) => void;
  mode?: "date" | "datetime" | "range";
  valueTo?: string | null;
  onChangeTo?: (iso: string | null) => void;
  min?: string | null;
  max?: string | null;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  timeStep?: number;
  presets?: Preset[] | boolean;
  error?: string;
  clearable?: boolean;
}

export function DatePicker({
  value,
  onChange,
  mode = "date",
  valueTo,
  onChangeTo,
  min,
  max,
  disabled = false,
  readOnly = false,
  required = false,
  placeholder,
  timeStep = 15,
  presets = false,
  error,
  clearable = true,
}: DatePickerProps) {
  const { locale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [inputToText, setInputToText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editingTo, setEditingTo] = useState(false);
  const [rangeField, setRangeField] = useState<"from" | "to">("from");
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputToRef = useRef<HTMLInputElement>(null);

  // ── Display values ────────────────────────────────────────────
  const displayMode = mode === "datetime" ? "datetime" : "date";
  const displayValue = editing ? inputText : formatDate(value, locale, displayMode);
  const displayToValue = editingTo ? inputToText : formatDate(valueTo ?? null, locale, "date");

  // Auto placeholder
  const autoPlaceholder = placeholder ?? (mode === "datetime" ? getDateTimePlaceholder(locale) : getDatePlaceholder(locale));

  // ── Calendar display month/year ───────────────────────────────
  const initialDate = value ? new Date(value) : new Date();
  const [displayMonth, setDisplayMonth] = useState(initialDate.getMonth() + 1);
  const [displayYear, setDisplayYear] = useState(initialDate.getFullYear());

  // Sync calendar to value when it changes externally
  useEffect(() => {
    if (value && !open) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setDisplayMonth(d.getMonth() + 1);
        setDisplayYear(d.getFullYear());
      }
    }
  }, [value, open]);

  // ── Presets ───────────────────────────────────────────────────
  const resolvedPresets = useMemo(() => {
    if (presets === true) return getDefaultPresets(t);
    if (Array.isArray(presets)) return presets;
    return null;
  }, [presets, t]);

  // ── Close on outside click ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
        setEditingTo(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Keyboard handler ──────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent, field: "from" | "to" = "from") => {
    if (e.key === "Escape") {
      setOpen(false);
      setEditing(false);
      setEditingTo(false);
      if (field === "from") setInputText("");
      else setInputToText("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      const text = field === "from" ? inputText : inputToText;
      if (text.trim()) {
        const parsed = mode === "datetime" ? parseDateTime(text, locale) : parseDate(text, locale);
        if (parsed && !isDateDisabled(new Date(parsed), min, max)) {
          if (field === "from") {
            onChange(parsed);
            // Auto-advance to-date in range mode
            if (mode === "range" && valueTo && new Date(parsed) > new Date(valueTo)) {
              onChangeTo?.(parsed);
            }
          } else {
            onChangeTo?.(parsed);
          }
        }
      }
      setOpen(false);
      setEditing(false);
      setEditingTo(false);
      setInputText("");
      setInputToText("");
    } else if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    }
  }, [inputText, inputToText, locale, mode, min, max, onChange, onChangeTo, valueTo, open]);

  // ── Blur handler (validate typed input) ───────────────────────
  const handleBlur = useCallback((field: "from" | "to" = "from") => {
    const text = field === "from" ? inputText : inputToText;
    if (text.trim()) {
      const parsed = mode === "datetime" ? parseDateTime(text, locale) : parseDate(text, locale);
      if (parsed && !isDateDisabled(new Date(parsed), min, max)) {
        if (field === "from") {
          onChange(parsed);
          if (mode === "range" && valueTo && new Date(parsed) > new Date(valueTo)) {
            onChangeTo?.(parsed);
          }
        } else {
          // Enforce to >= from
          if (value && new Date(parsed) < new Date(value)) {
            // Reject — revert
          } else {
            onChangeTo?.(parsed);
          }
        }
      }
    }
    if (field === "from") { setEditing(false); setInputText(""); }
    else { setEditingTo(false); setInputToText(""); }
  }, [inputText, inputToText, locale, mode, min, max, onChange, onChangeTo, value, valueTo]);

  // ── Calendar selection ────────────────────────────────────────
  const handleCalendarSelect = useCallback((iso: string) => {
    if (mode === "range") {
      if (rangeField === "from") {
        onChange(iso);
        // Auto-advance to-date if from moves past it
        if (valueTo && new Date(iso) > new Date(valueTo)) {
          onChangeTo?.(iso);
        }
        setRangeField("to");
        return; // Don't close — let user pick to-date
      } else {
        // To field — enforce >= from
        if (value && new Date(iso) < new Date(value)) {
          // Select as new from instead
          onChange(iso);
          onChangeTo?.(null);
          setRangeField("to");
          return;
        }
        onChangeTo?.(iso);
        setRangeField("from");
        setOpen(false);
        return;
      }
    }

    if (mode === "datetime") {
      // Preserve existing time when selecting a new date
      const existing = value ? new Date(value) : null;
      const newDate = new Date(iso);
      if (existing) {
        newDate.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
      }
      onChange(newDate.toISOString());
      // Don't close — let user adjust time
      return;
    }

    // Simple date mode
    onChange(iso);
    setOpen(false);
  }, [mode, rangeField, onChange, onChangeTo, value, valueTo]);

  // ── Preset selection ──────────────────────────────────────────
  const handlePresetSelect = useCallback((from: string | null, to: string | null) => {
    onChange(from);
    onChangeTo?.(to);
    if (from) {
      const d = new Date(from);
      setDisplayMonth(d.getMonth() + 1);
      setDisplayYear(d.getFullYear());
    }
    setOpen(false);
  }, [onChange, onChangeTo]);

  // ── Time change ───────────────────────────────────────────────
  const handleTimeChange = useCallback((hours: number, minutes: number) => {
    const d = value ? new Date(value) : new Date();
    d.setHours(hours, minutes, 0, 0);
    onChange(d.toISOString());
  }, [value, onChange]);

  // ── Clear ─────────────────────────────────────────────────────
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (mode === "range") onChangeTo?.(null);
    setOpen(false);
  }, [onChange, onChangeTo, mode]);

  // ── Derived state for calendar ────────────────────────────────
  const selectedDate = value ? new Date(value) : null;
  const rangeFromDate = mode === "range" && value ? new Date(value) : undefined;
  const rangeToDate = mode === "range" && valueTo ? new Date(valueTo) : undefined;

  const hasValue = mode === "range" ? !!(value || valueTo) : !!value;
  const borderColor = error ? "var(--danger-border, var(--danger-text))" :
    required && !hasValue ? "var(--danger-border, var(--danger-text))" :
    open ? "var(--border-focus)" : "var(--input-border)";

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="dp-wrap" ref={wrapRef}>
      <div className="dp-input-row">
        {/* FROM / single input */}
        <div
          className="dp-input-box"
          style={{
            borderColor,
            boxShadow: open ? "0 0 0 3px var(--ring-focus)" : "none",
            background: readOnly ? "var(--input-bg-ro)" : "var(--input-bg)",
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={() => {
            if (!disabled && !readOnly) {
              setOpen(true);
              setRangeField("from");
              inputRef.current?.focus();
            }
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="dp-text-input"
            value={displayValue}
            placeholder={autoPlaceholder}
            disabled={disabled}
            readOnly={readOnly}
            onChange={e => { setEditing(true); setInputText(e.target.value); }}
            onFocus={() => {
              if (!readOnly && !disabled) {
                setEditing(true);
                setInputText(formatDate(value, locale, displayMode));
                setOpen(true);
                setRangeField("from");
              }
            }}
            onBlur={() => handleBlur("from")}
            onKeyDown={e => handleKeyDown(e, "from")}
          />
          {mode === "datetime" && value && !readOnly && (
            <DatePickerTime
              hours={new Date(value).getHours()}
              minutes={new Date(value).getMinutes()}
              locale={locale}
              timeStep={timeStep}
              disabled={disabled || readOnly}
              onChange={handleTimeChange}
            />
          )}
          {!readOnly && (
            <button
              type="button"
              className="dp-icon-btn"
              tabIndex={-1}
              onClick={e => {
                e.stopPropagation();
                if (!disabled) setOpen(o => !o);
              }}
            >
              <CalendarIcon />
            </button>
          )}
          {clearable && hasValue && !disabled && !readOnly && (
            <button type="button" className="dp-clear-btn" tabIndex={-1} onClick={handleClear}>
              ×
            </button>
          )}
        </div>

        {/* Range TO input */}
        {mode === "range" && (
          <>
            <span className="dp-range-sep">→</span>
            <div
              className="dp-input-box"
              style={{
                borderColor: error ? "var(--danger-border, var(--danger-text))" :
                  open && rangeField === "to" ? "var(--border-focus)" : "var(--input-border)",
                boxShadow: open && rangeField === "to" ? "0 0 0 3px var(--ring-focus)" : "none",
                background: readOnly ? "var(--input-bg-ro)" : "var(--input-bg)",
                opacity: disabled ? 0.5 : 1,
              }}
              onClick={() => {
                if (!disabled && !readOnly) {
                  setOpen(true);
                  setRangeField("to");
                  inputToRef.current?.focus();
                }
              }}
            >
              <input
                ref={inputToRef}
                type="text"
                className="dp-text-input"
                value={displayToValue}
                placeholder={autoPlaceholder}
                disabled={disabled}
                readOnly={readOnly}
                onChange={e => { setEditingTo(true); setInputToText(e.target.value); }}
                onFocus={() => {
                  if (!readOnly && !disabled) {
                    setEditingTo(true);
                    setInputToText(formatDate(valueTo ?? null, locale, "date"));
                    setOpen(true);
                    setRangeField("to");
                  }
                }}
                onBlur={() => handleBlur("to")}
                onKeyDown={e => handleKeyDown(e, "to")}
              />
              <button
                type="button"
                className="dp-icon-btn"
                tabIndex={-1}
                onClick={e => {
                  e.stopPropagation();
                  if (!disabled && !readOnly) { setOpen(o => !o); setRangeField("to"); }
                }}
              >
                <CalendarIcon />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {error && <div className="dp-error">{error}</div>}

      {/* Popup */}
      {open && !disabled && !readOnly && (
        <div className="dp-popup" onMouseDown={e => e.preventDefault()}>
          {resolvedPresets && (
            <DatePickerPresets
              presets={resolvedPresets}
              currentFrom={value}
              currentTo={valueTo ?? null}
              onSelect={handlePresetSelect}
            />
          )}
          <DatePickerCalendar
            selected={selectedDate}
            displayMonth={displayMonth}
            displayYear={displayYear}
            locale={locale}
            min={mode === "range" && rangeField === "to" ? value : min}
            max={max}
            rangeFrom={rangeFromDate}
            rangeTo={rangeToDate}
            hoverDate={mode === "range" ? hoverDate : undefined}
            onHoverDate={mode === "range" ? setHoverDate : undefined}
            onSelect={handleCalendarSelect}
            onMonthChange={(m, y) => { setDisplayMonth(m); setDisplayYear(y); }}
          />
        </div>
      )}

      <style>{`
        .dp-wrap {
          position: relative;
          display: inline-flex;
          flex-direction: column;
        }
        .dp-input-row {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .dp-input-box {
          display: inline-flex;
          align-items: center;
          height: 34px;
          border: 1px solid var(--input-border);
          border-radius: 8px;
          padding: 0 4px 0 0;
          cursor: text;
          transition: border-color 0.15s, box-shadow 0.15s;
          gap: 2px;
        }
        .dp-text-input {
          flex: 1;
          min-width: 0;
          height: 100%;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 13px;
          padding: 0 10px;
          outline: none;
        }
        .dp-text-input::placeholder {
          color: var(--text-muted);
        }
        .dp-text-input:disabled {
          cursor: not-allowed;
        }
        .dp-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 4px;
          color: var(--text-muted);
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .dp-icon-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .dp-clear-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 50%;
          color: var(--text-muted);
          font-size: 16px;
          line-height: 1;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .dp-clear-btn:hover {
          background: var(--bg-hover);
          color: var(--danger-text);
        }
        .dp-range-sep {
          color: var(--text-muted);
          font-size: 14px;
          flex-shrink: 0;
        }
        .dp-error {
          font-size: 11px;
          color: var(--danger-text);
          margin-top: 4px;
        }
        .dp-popup {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.14);
          z-index: 1000;
          display: flex;
          flex-direction: row;
        }
      `}</style>
    </div>
  );
}
