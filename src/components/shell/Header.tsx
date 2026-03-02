"use client";

import { Icon } from "@/components/icons/Icon";
import { UserMenu } from "./UserMenu";
import type { ReactNode } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  onBackClick?: () => void;
  showBack?: boolean;
  domain: string;
  domains: string[];
  onDomainChange: (d: string) => void;
  children?: ReactNode;
  notificationSlot?: ReactNode;
  onNavigate?: (key: string) => void;
}

export function Header({
  title, subtitle, onMenuClick, onBackClick, showBack,
  domain, domains, onDomainChange, notificationSlot, onNavigate,
}: HeaderProps) {
  return (
    <header
      className="h-13 flex items-center px-3 gap-2 flex-shrink-0"
      style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--header-border)" }}
    >
      {showBack ? (
        <button onClick={onBackClick} className="p-1.5 rounded-md transition-colors" style={{ color: "var(--header-text-muted)" }}>
          <Icon name="arrowLeft" size={20} />
        </button>
      ) : (
        <button onClick={onMenuClick} className="p-1.5 rounded-md transition-colors" style={{ color: "var(--header-text-muted)" }}>
          <Icon name="menu" size={20} />
        </button>
      )}

      {domains.length > 1 && (
        <select
          value={domain}
          onChange={e => onDomainChange(e.target.value)}
          className="text-xs font-medium rounded-md px-2 py-1.5 cursor-pointer"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "var(--header-text)",
          }}
        >
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      )}

      <div className="text-sm font-semibold truncate" style={{ color: "var(--header-text)" }}>{title}</div>
      {subtitle && (
        <div className="text-sm truncate" style={{ color: "var(--header-text-muted)" }}>
          <span style={{ color: "rgba(255,255,255,0.2)" }} className="mx-1">/</span>
          {subtitle}
        </div>
      )}

      <div className="flex-1" />

      {notificationSlot}

      <UserMenu onNavigate={onNavigate} />
    </header>
  );
}
