/**
 * UI Primitives — shared form + layout components.
 * All styling uses CSS custom properties for theme support.
 */
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";

// ── Section ────────────────────────────────────────────────────────
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Field ──────────────────────────────────────────────────────────
export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div {...(required ? { "data-required": true } : {})}>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {label}
        {required && <span style={{ color: "var(--danger-text)" }} className="ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────────
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange?: (value: string) => void;
}

export function Input({ value, onChange, readOnly, className = "", style, ...rest }: InputProps) {
  return (
    <input
      value={value ?? ""}
      onChange={e => onChange?.(e.target.value)}
      readOnly={readOnly}
      className={`w-full px-3 py-2 text-sm rounded-lg transition-all outline-none ${className}`}
      style={{
        background: readOnly ? "var(--input-bg-ro)" : "var(--input-bg)",
        border: `1px solid ${readOnly ? "var(--input-border-ro)" : "var(--input-border)"}`,
        color: readOnly ? "var(--text-secondary)" : "var(--text-primary)",
        cursor: readOnly ? "default" : undefined,
        ...style,
      }}
      onFocus={e => {
        if (!readOnly) {
          e.currentTarget.style.borderColor = "var(--border-focus)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--ring-focus)";
        }
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = readOnly ? "var(--input-border-ro)" : "var(--input-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...rest}
    />
  );
}

// ── Select ─────────────────────────────────────────────────────────
interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  value: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
}

export function Select({ value, onChange, options, className = "", ...rest }: SelectProps) {
  return (
    <select
      value={value}
      onChange={e => onChange?.(e.target.value)}
      className={`w-full px-3 py-2 text-sm rounded-lg transition-all outline-none cursor-pointer ${className}`}
      style={{
        background: "var(--input-bg)",
        border: "1px solid var(--input-border)",
        color: "var(--text-primary)",
      }}
      {...rest}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Checkbox ───────────────────────────────────────────────────────
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded"
        style={{ accentColor: "var(--accent)" }}
      />
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
    </label>
  );
}

// ── Badge ──────────────────────────────────────────────────────────
type BadgeVariant = "success" | "danger" | "warning" | "neutral";

const BADGE_STYLES: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: "var(--success-bg)", text: "var(--success-text)" },
  danger:  { bg: "var(--danger-bg)",  text: "var(--danger-text)" },
  warning: { bg: "var(--warning-bg)", text: "var(--warning-text)" },
  neutral: { bg: "var(--bg-surface-alt)", text: "var(--text-secondary)" },
};

export function Badge({ children, variant = "neutral" }: { children: ReactNode; variant?: BadgeVariant }) {
  const s = BADGE_STYLES[variant];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {children}
    </span>
  );
}

// ── TabBar ─────────────────────────────────────────────────────────
export type TabDef = { key: string; label: string; icon?: ReactNode };

export function TabBar({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (key: string) => void }) {
  return (
    <div
      className="flex overflow-x-auto flex-shrink-0 px-2"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}
    >
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
          style={{
            borderBottom: `2px solid ${active === tab.key ? "var(--accent)" : "transparent"}`,
            color: active === tab.key ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
