"use client";
/**
 * DatePickerTime — Time selector sub-component.
 * Dropdown list of times at configurable step intervals.
 * Supports 12h/24h based on locale, plus direct keyboard entry.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { generateTimeOptions, parseTime, localeUses12Hour } from "./date-utils";

interface DatePickerTimeProps {
  /** Current hours (0-23) */
  hours: number;
  /** Current minutes (0-59) */
  minutes: number;
  locale: string;
  timeStep: number;
  disabled?: boolean;
  onChange: (hours: number, minutes: number) => void;
}

export function DatePickerTime({ hours, minutes, locale, timeStep, disabled, onChange }: DatePickerTimeProps) {
  const options = useMemo(() => generateTimeOptions(timeStep, locale), [timeStep, locale]);
  const uses12h = useMemo(() => localeUses12Hour(locale), [locale]);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Format current time for display
  const displayValue = useMemo(() => {
    const hh = hours.toString().padStart(2, "0");
    const mm = minutes.toString().padStart(2, "0");
    if (uses12h) {
      const period = hours < 12 ? "AM" : "PM";
      const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${h12}:${mm} ${period}`;
    }
    return `${hh}:${mm}`;
  }, [hours, minutes, uses12h]);

  // Current value key for highlighting
  const currentKey = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

  // Scroll to selected option when opening
  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector("[data-active]");
      if (active) active.scrollIntoView({ block: "center" });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
  };

  const handleInputBlur = () => {
    if (inputValue.trim()) {
      const parsed = parseTime(inputValue);
      if (parsed) {
        onChange(parsed.hours, parsed.minutes);
      }
    }
    setInputValue("");
    setOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setInputValue("");
      setOpen(false);
    }
  };

  return (
    <div className="dpt-wrap" ref={wrapRef}>
      <input
        type="text"
        className="dpt-input"
        value={inputValue || displayValue}
        onChange={e => handleInputChange(e.target.value)}
        onFocus={() => { setOpen(true); setInputValue(""); }}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        disabled={disabled}
        placeholder={uses12h ? "hh:mm AM" : "HH:mm"}
      />
      <svg className="dpt-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
      {open && (
        <div className="dpt-dropdown" ref={listRef}>
          {options.map(opt => {
            const isActive = opt.value === currentKey;
            return (
              <button
                key={opt.value}
                type="button"
                className={`dpt-option${isActive ? " dpt-active" : ""}`}
                data-active={isActive ? "" : undefined}
                onMouseDown={e => {
                  e.preventDefault();
                  const [h, m] = opt.value.split(":").map(Number);
                  onChange(h, m);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        .dpt-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .dpt-input {
          width: 100px;
          height: 34px;
          padding: 0 28px 0 10px;
          font-size: 13px;
          border: 1px solid var(--input-border);
          border-radius: 8px;
          background: var(--input-bg);
          color: var(--text-primary);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .dpt-input:focus {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--ring-focus);
        }
        .dpt-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .dpt-icon {
          position: absolute;
          right: 8px;
          pointer-events: none;
          color: var(--text-muted);
        }
        .dpt-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          width: 120px;
          max-height: 200px;
          overflow-y: auto;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          z-index: 1001;
          padding: 4px;
        }
        .dpt-option {
          display: block;
          width: 100%;
          padding: 6px 10px;
          font-size: 13px;
          text-align: left;
          border: none;
          background: none;
          color: var(--text-primary);
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.1s;
        }
        .dpt-option:hover { background: var(--bg-hover); }
        .dpt-active {
          background: var(--accent-light) !important;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
