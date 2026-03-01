"use client";

import { useState, useRef, useEffect } from "react";
import { Flag } from "@/components/ui/Flag";
import { Icon } from "@/components/icons/Icon";

interface LocaleOption {
  value: string;
  label: string;
}

interface LocaleSelectProps {
  value: string;
  onChange: (code: string) => void;
  options: LocaleOption[];
}

export function LocaleSelect({ value, onChange, options }: LocaleSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find(o => o.value === value);
  // Show just the description part (after the " — ")
  const displayLabel = (opt: LocaleOption) => {
    const dash = opt.label.indexOf(" — ");
    return dash > 0 ? opt.label.slice(dash + 3) : opt.label;
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          minHeight: 34,
        }}
      >
        {value && <Flag code={value} size={16} />}
        <span className="flex-1 text-left truncate">
          {selected ? displayLabel(selected) : value || "—"}
        </span>
        <Icon name="chevDown" size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md shadow-lg overflow-auto"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            maxHeight: 260,
          }}
        >
          {options.map(o => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                style={{
                  backgroundColor: isSelected ? "var(--bg-hover)" : "var(--bg-surface)",
                  color: "var(--text-primary)",
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-hover)" : "var(--bg-surface)")}
              >
                <Flag code={o.value} size={16} />
                <span className="truncate">{displayLabel(o)}</span>
                {isSelected && <Icon name="check" size={14} style={{ color: "var(--accent)", marginLeft: "auto", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
