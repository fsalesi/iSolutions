"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/Icon";

export type NavItem = { key: string; label: string; icon: string; href?: string };
export type NavSection = { key: string; label: string; icon: string; items: NavItem[] };

interface SidebarProps {
  sections: NavSection[];
  activeItem: string;
  onNavigate: (key: string) => void;
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

export function Sidebar({ sections, activeItem, onNavigate, open, onClose, isMobile }: SidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ admin: true });
  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const isExpanded = open;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40" style={{ background: "var(--bg-overlay)" }} onClick={onClose} />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          ${!open ? "w-0" : ""}
          flex-shrink-0 transition-all duration-200 overflow-hidden flex flex-col
        `}
        style={{
          background: "var(--sidebar-bg)",
          width: open ? 240 : 0,
        }}

      >
        {/* Logo */}
        <div
          className="h-13 flex items-center px-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          {isExpanded ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-lg font-bold tracking-tight whitespace-nowrap" style={{ color: "var(--sidebar-text-hover)" }}>
                iSolutions
              </span>
              <button onClick={onClose} className="p-1" style={{ color: "var(--sidebar-text)" }}>
                  <Icon name="x" size={18} />
                </button>
            </div>
          ) : (
            <span className="text-lg font-bold mx-auto" style={{ color: "var(--sidebar-text-hover)" }}>
              iS
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 text-sm">
          {sections.map(section => (
            <div key={section.key} className="mb-1">
              {/* Section header — clickable to expand/collapse */}
              <button
                onClick={() => toggle(section.key)}
                className="w-full flex items-center gap-2 px-4 py-2 transition-colors"
                style={{ color: "var(--sidebar-section)" }}
                
                onMouseEnter={e => (e.currentTarget.style.color = "var(--sidebar-text-hover)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--sidebar-section)")}
              >
                <Icon name={section.icon} size={15} className="flex-shrink-0" />
                <span className="flex-1 text-left font-medium text-xs uppercase tracking-wider whitespace-nowrap">{section.label}</span>
                <Icon name={expanded[section.key] ? "chevDown" : "chevRight"} size={14} />
              </button>

              {/* Items — show when section expanded AND sidebar expanded, or always when collapsed (as icon-only) */}
              {expanded[section.key] && section.items.map(item => {
                const isActive = activeItem === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => { onNavigate(item.key); if (isMobile) onClose(); }}
                    className="w-full flex items-center gap-2.5 py-1.5 text-[13px] transition-colors"
                    style={{
                      paddingLeft: 32,
                      paddingRight: 16,
                      color: isActive ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                      background: isActive ? "var(--sidebar-active-bg)" : "transparent",
                      borderRight: isActive ? "2px solid var(--sidebar-active-text)" : "2px solid transparent",
                    }}
                    
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.color = "var(--sidebar-text-hover)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.color = "var(--sidebar-text)";
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <Icon name={item.icon} size={14} className="flex-shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
