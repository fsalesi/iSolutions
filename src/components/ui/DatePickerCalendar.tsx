"use client";
/**
 * DatePickerCalendar — Calendar grid sub-component.
 * Supports day view, month picker, and year picker (drill-up).
 * Range highlighting when rangeFrom/rangeTo are provided.
 */
import { useState, useMemo, useCallback } from "react";
import {
  daysInMonth, firstDayOfMonth, getMonthNames, getWeekdayNames,
  isSameDay, isInRange, isDateDisabled,
} from "./date-utils";

type CalendarView = "days" | "months" | "years";

interface DatePickerCalendarProps {
  /** Currently selected date */
  selected: Date | null;
  /** Month/year being displayed */
  displayMonth: number; // 1-12
  displayYear: number;
  locale: string;
  min?: string | null;
  max?: string | null;
  /** Range mode highlight */
  rangeFrom?: Date | null;
  rangeTo?: Date | null;
  /** Hover date for range preview */
  hoverDate?: Date | null;
  onHoverDate?: (d: Date | null) => void;
  onSelect: (iso: string) => void;
  onMonthChange: (month: number, year: number) => void;
}

export function DatePickerCalendar({
  selected,
  displayMonth,
  displayYear,
  locale,
  min,
  max,
  rangeFrom,
  rangeTo,
  hoverDate,
  onHoverDate,
  onSelect,
  onMonthChange,
}: DatePickerCalendarProps) {
  const [view, setView] = useState<CalendarView>("days");
  const [yearPageStart, setYearPageStart] = useState(() => displayYear - (displayYear % 12));

  const monthNames = useMemo(() => getMonthNames(locale, "long"), [locale]);
  const shortMonthNames = useMemo(() => getMonthNames(locale, "short"), [locale]);
  const weekdays = useMemo(() => getWeekdayNames(locale, "narrow"), [locale]);

  const goToPrevMonth = useCallback(() => {
    if (displayMonth === 1) onMonthChange(12, displayYear - 1);
    else onMonthChange(displayMonth - 1, displayYear);
  }, [displayMonth, displayYear, onMonthChange]);

  const goToNextMonth = useCallback(() => {
    if (displayMonth === 12) onMonthChange(1, displayYear + 1);
    else onMonthChange(displayMonth + 1, displayYear);
  }, [displayMonth, displayYear, onMonthChange]);

  const goToToday = useCallback(() => {
    const now = new Date();
    onMonthChange(now.getMonth() + 1, now.getFullYear());
    onSelect(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
  }, [onMonthChange, onSelect]);

  // ── Days view ────────────────────────────────────────────────────
  const renderDays = () => {
    const days = daysInMonth(displayYear, displayMonth);
    const firstDay = firstDayOfMonth(displayYear, displayMonth);
    // Adjust so Monday = 0
    const startOffset = (firstDay + 6) % 7;
    const today = new Date();
    const cells: React.ReactNode[] = [];

    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) {
      cells.push(<div key={`e-${i}`} className="dp-cell dp-empty" />);
    }

    for (let d = 1; d <= days; d++) {
      const date = new Date(displayYear, displayMonth - 1, d);
      const disabled = isDateDisabled(date, min, max);
      const isToday = isSameDay(date, today);
      const isSelected = selected && isSameDay(date, selected);

      // Range styling
      const effectiveTo = rangeTo || hoverDate;
      const inRange = rangeFrom && effectiveTo
        ? isInRange(date, rangeFrom, effectiveTo) && !isSameDay(date, rangeFrom) && !isSameDay(date, effectiveTo)
        : false;
      const isRangeStart = rangeFrom && isSameDay(date, rangeFrom);
      const isRangeEnd = effectiveTo && isSameDay(date, effectiveTo);

      let cls = "dp-cell dp-day";
      if (disabled) cls += " dp-disabled";
      if (isToday) cls += " dp-today";
      if (isSelected && !rangeFrom) cls += " dp-selected";
      if (isRangeStart) cls += " dp-range-start dp-selected";
      if (isRangeEnd) cls += " dp-range-end dp-selected";
      if (inRange) cls += " dp-in-range";

      cells.push(
        <button
          key={d}
          type="button"
          className={cls}
          disabled={disabled}
          onClick={() => !disabled && onSelect(date.toISOString())}
          onMouseEnter={() => onHoverDate?.(date)}
          onMouseLeave={() => onHoverDate?.(null)}
          tabIndex={-1}
        >
          {d}
        </button>
      );
    }

    return (
      <>
        <div className="dp-header">
          <button type="button" className="dp-nav" onClick={goToPrevMonth} tabIndex={-1} aria-label="Previous month">‹</button>
          <button
            type="button"
            className="dp-title"
            onClick={() => { setView("months"); }}
            tabIndex={-1}
          >
            {monthNames[displayMonth - 1]} {displayYear}
          </button>
          <button type="button" className="dp-nav" onClick={goToNextMonth} tabIndex={-1} aria-label="Next month">›</button>
        </div>
        <div className="dp-weekdays">
          {weekdays.map((wd, i) => <div key={i} className="dp-weekday">{wd}</div>)}
        </div>
        <div className="dp-grid dp-grid-7">
          {cells}
        </div>
        <div className="dp-footer">
          <button type="button" className="dp-today-btn" onClick={goToToday} tabIndex={-1}>Today</button>
        </div>
      </>
    );
  };

  // ── Months view ──────────────────────────────────────────────────
  const renderMonths = () => (
    <>
      <div className="dp-header">
        <button type="button" className="dp-nav" onClick={() => onMonthChange(displayMonth, displayYear - 1)} tabIndex={-1}>‹</button>
        <button
          type="button"
          className="dp-title"
          onClick={() => { setYearPageStart(displayYear - (displayYear % 12)); setView("years"); }}
          tabIndex={-1}
        >
          {displayYear}
        </button>
        <button type="button" className="dp-nav" onClick={() => onMonthChange(displayMonth, displayYear + 1)} tabIndex={-1}>›</button>
      </div>
      <div className="dp-grid dp-grid-3">
        {shortMonthNames.map((name, i) => {
          const isCurrent = i + 1 === displayMonth;
          return (
            <button
              key={i}
              type="button"
              className={`dp-cell dp-month-cell${isCurrent ? " dp-selected" : ""}`}
              onClick={() => { onMonthChange(i + 1, displayYear); setView("days"); }}
              tabIndex={-1}
            >
              {name}
            </button>
          );
        })}
      </div>
    </>
  );

  // ── Years view ───────────────────────────────────────────────────
  const renderYears = () => {
    const years = Array.from({ length: 12 }, (_, i) => yearPageStart + i);
    return (
      <>
        <div className="dp-header">
          <button type="button" className="dp-nav" onClick={() => setYearPageStart(p => p - 12)} tabIndex={-1}>‹</button>
          <span className="dp-title dp-title-static">
            {yearPageStart} – {yearPageStart + 11}
          </span>
          <button type="button" className="dp-nav" onClick={() => setYearPageStart(p => p + 12)} tabIndex={-1}>›</button>
        </div>
        <div className="dp-grid dp-grid-3">
          {years.map(y => {
            const isCurrent = y === displayYear;
            return (
              <button
                key={y}
                type="button"
                className={`dp-cell dp-year-cell${isCurrent ? " dp-selected" : ""}`}
                onClick={() => { onMonthChange(displayMonth, y); setView("months"); }}
                tabIndex={-1}
              >
                {y}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="dp-calendar">
      {view === "days" && renderDays()}
      {view === "months" && renderMonths()}
      {view === "years" && renderYears()}

      <style>{`
        .dp-calendar {
          width: 252px;
          padding: 8px;
          user-select: none;
        }
        .dp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .dp-nav {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 6px;
          font-size: 16px;
          color: var(--text-secondary);
          transition: background 0.15s;
        }
        .dp-nav:hover { background: var(--bg-hover); }
        .dp-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          cursor: pointer;
          border: none;
          background: none;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .dp-title:hover { background: var(--bg-hover); }
        .dp-title-static {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          padding: 4px 8px;
          cursor: default;
        }
        .dp-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          margin-bottom: 0;
        }
        .dp-weekday {
          text-align: center;
          font-size: 10px;
          font-weight: 500;
          color: var(--text-muted);
          padding: 1px 0;
        }
        .dp-grid {
          display: grid;
          gap: 1px;
        }
        .dp-grid-7 { grid-template-columns: repeat(7, 1fr); }
        .dp-grid-3 { grid-template-columns: repeat(3, 1fr); gap: 4px; }
        .dp-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 6px;
          font-size: 13px;
          color: var(--text-primary);
          transition: background 0.15s, color 0.15s;
        }
        .dp-day {
          width: 32px;
          height: 26px;
          font-size: 12px;
        }
        .dp-empty {
          cursor: default;
        }
        .dp-cell:not(.dp-disabled):not(.dp-empty):not(.dp-selected):hover {
          background: var(--bg-hover);
        }
        .dp-today {
          font-weight: 700;
          box-shadow: inset 0 0 0 1px var(--accent);
        }
        .dp-selected {
          background: var(--accent) !important;
          color: white !important;
          font-weight: 600;
        }
        .dp-in-range {
          background: var(--accent-light) !important;
          border-radius: 0;
        }
        .dp-range-start {
          border-radius: 6px 0 0 6px !important;
        }
        .dp-range-end {
          border-radius: 0 6px 6px 0 !important;
        }
        .dp-disabled {
          color: var(--text-muted);
          cursor: default;
          opacity: 0.4;
        }
        .dp-month-cell, .dp-year-cell {
          padding: 8px 4px;
          font-size: 13px;
        }
        .dp-footer {
          display: flex;
          justify-content: center;
          margin-top: 1px;
          padding-top: 1px;
          border-top: none;
        }
        .dp-today-btn {
          font-size: 11px;
          font-weight: 500;
          color: var(--accent);
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 8px;
          border-radius: 4px;
          transition: background 0.15s;
        }
        .dp-today-btn:hover { background: var(--bg-hover); }
      `}</style>
    </div>
  );
}
