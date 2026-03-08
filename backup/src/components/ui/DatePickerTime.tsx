"use client";
/**
 * DatePickerTime — Three-column spinner: ▲ HH ▼ : ▲ MM ▼  ▲ AM/PM ▼
 */
import { useMemo, useCallback } from "react";
import { localeUses12Hour } from "./date-utils";

interface DatePickerTimeProps {
  hours: number;
  minutes: number;
  locale: string;
  timeStep?: number;
  disabled?: boolean;
  onChange: (hours: number, minutes: number) => void;
}

function SpinColumn({ value, onUp, onDown }: {
  value: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="dpt-spin">
      <button type="button" className="dpt-arrow" onMouseDown={e => { e.preventDefault(); onUp(); }}>
        <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
      </button>
      <span className="dpt-val">{value}</span>
      <button type="button" className="dpt-arrow" onMouseDown={e => { e.preventDefault(); onDown(); }}>
        <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

export function DatePickerTime({ hours, minutes, locale, timeStep = 1, disabled, onChange }: DatePickerTimeProps) {
  const uses12h = useMemo(() => localeUses12Hour(locale), [locale]);
  const step = Math.max(1, Math.min(timeStep, 30));

  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours < 12 ? "AM" : "PM";

  const hourUp = useCallback(() => {
    if (uses12h) {
      const next = h12 === 12 ? 1 : h12 + 1;
      const h24 = period === "AM" ? (next === 12 ? 0 : next) : (next === 12 ? 12 : next + 12);
      onChange(h24, minutes);
    } else {
      onChange((hours + 1) % 24, minutes);
    }
  }, [uses12h, h12, hours, period, minutes, onChange]);

  const hourDown = useCallback(() => {
    if (uses12h) {
      const next = h12 === 1 ? 12 : h12 - 1;
      const h24 = period === "AM" ? (next === 12 ? 0 : next) : (next === 12 ? 12 : next + 12);
      onChange(h24, minutes);
    } else {
      onChange((hours + 23) % 24, minutes);
    }
  }, [uses12h, h12, hours, period, minutes, onChange]);

  const minUp = useCallback(() => {
    const next = (minutes + step) % 60;
    onChange(hours, next);
  }, [hours, minutes, step, onChange]);

  const minDown = useCallback(() => {
    const next = (minutes - step + 60) % 60;
    onChange(hours, next);
  }, [hours, minutes, step, onChange]);

  const togglePeriod = useCallback(() => {
    const newH = period === "AM" ? hours + 12 : hours - 12;
    onChange(Math.max(0, Math.min(23, newH)), minutes);
  }, [hours, minutes, period, onChange]);

  if (disabled) {
    const display = uses12h
      ? `${h12}:${minutes.toString().padStart(2, "0")} ${period}`
      : `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    return <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{display}</span>;
  }

  const hourLabel = uses12h ? String(h12) : hours.toString().padStart(2, "0");
  const minLabel = minutes.toString().padStart(2, "0");

  return (
    <div className="dpt-wrap">
      <SpinColumn value={hourLabel} onUp={hourUp} onDown={hourDown} />
      <span className="dpt-colon">:</span>
      <SpinColumn value={minLabel} onUp={minUp} onDown={minDown} />
      {uses12h && (
        <>
          <SpinColumn value={period} onUp={togglePeriod} onDown={togglePeriod} />
        </>
      )}

      <style>{`
        .dpt-wrap {
          display: flex;
          align-items: center;
          gap: 2px;
          user-select: none;
        }
        .dpt-spin {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }
        .dpt-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 16px;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-muted);
          border-radius: 4px;
          transition: background 0.1s, color 0.1s;
        }
        .dpt-arrow:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .dpt-val {
          font-size: 13px;
          font-weight: 600;
          color: var(--accent);
          min-width: 28px;
          text-align: center;
          line-height: 1;
          padding: 1px 0;
        }
        .dpt-colon {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          margin: 0 1px;
          align-self: center;
        }
      `}</style>
    </div>
  );
}
