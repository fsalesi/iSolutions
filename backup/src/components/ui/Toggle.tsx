"use client";
/**
 * Toggle — Two-state or three-state (nullable) sliding toggle.
 *
 * Two-state:   OFF ←→ ON
 * Three-state: OFF ←→ NULL ←→ ON  (null = indeterminate / unset)
 */
import { useCallback } from "react";

interface ToggleProps {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  triState?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  labelOn?: string;
  labelOff?: string;
  labelNull?: string;
  size?: "sm" | "md";
  colorOn?: string;
  colorOff?: string;
}

export function Toggle({
  value,
  onChange,
  triState = false,
  disabled = false,
  readOnly = false,
  labelOn,
  labelOff,
  labelNull,
  size = "md",
  colorOn = "var(--accent)",
  colorOff = "var(--input-border)",
}: ToggleProps) {
  const handleClick = useCallback(() => {
    if (disabled || readOnly) return;
    if (triState) {
      // Cycle: false → null → true → false
      if (value === false) onChange(null);
      else if (value === null || value === undefined) onChange(true);
      else onChange(false);
    } else {
      onChange(!value);
    }
  }, [value, onChange, triState, disabled, readOnly]);

  const w = size === "sm" ? 32 : 40;
  const h = size === "sm" ? 18 : 22;
  const dot = size === "sm" ? 14 : 18;
  const pad = 2;

  // Dot position: off=left, null=center, on=right
  let dotX = pad;
  if (value === true) dotX = w - dot - pad;
  else if (value === null || value === undefined) {
    if (triState) dotX = (w - dot) / 2;
  }

  // Track color
  let trackBg = "var(--input-border)"; // off
  if (value === true) trackBg = colorOn;
  else if (value === false) trackBg = colorOff;
  else if (triState) trackBg = "var(--text-muted)";

  const label = value === true
    ? (labelOn ?? "")
    : value === false
      ? (labelOff ?? "")
      : (labelNull ?? "");

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value === true ? "true" : value === false ? "false" : "mixed"}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        disabled={disabled}
        style={{
          width: w,
          height: h,
          borderRadius: h / 2,
          background: trackBg,
          position: "relative",
          border: "none",
          cursor: disabled || readOnly ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: pad,
            left: dotX,
            width: dot,
            height: dot,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.2s",
          }}
        />
      </button>
      {label && (
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
      )}
    </div>
  );
}
