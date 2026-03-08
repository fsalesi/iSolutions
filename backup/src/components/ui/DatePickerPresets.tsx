"use client";
/**
 * DatePickerPresets — Quick-select presets panel for range mode.
 */
import type { Preset } from "./date-utils";

interface DatePickerPresetsProps {
  presets: Preset[];
  currentFrom: string | null;
  currentTo: string | null;
  onSelect: (from: string | null, to: string | null) => void;
}

export function DatePickerPresets({ presets, currentFrom, currentTo, onSelect }: DatePickerPresetsProps) {
  // Check if a preset matches current selection
  const isActive = (p: Preset) => {
    if (!currentFrom || !currentTo || !p.from || !p.to) return false;
    const fromMatch = new Date(currentFrom).toDateString() === new Date(p.from).toDateString();
    const toMatch = new Date(currentTo).toDateString() === new Date(p.to).toDateString();
    return fromMatch && toMatch;
  };

  return (
    <div className="dpp-wrap">
      {presets.map((p, i) => (
        <button
          key={i}
          type="button"
          className={`dpp-btn${isActive(p) ? " dpp-active" : ""}`}
          onClick={() => onSelect(p.from, p.to)}
        >
          {p.label}
        </button>
      ))}

      <style>{`
        .dpp-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px;
          min-width: 130px;
          border-right: 1px solid var(--border);
        }
        .dpp-btn {
          padding: 6px 10px;
          font-size: 12px;
          text-align: left;
          border: none;
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .dpp-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .dpp-active {
          background: var(--accent-light) !important;
          color: var(--accent) !important;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
