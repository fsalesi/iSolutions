"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/Icon";

export type NavItem    = { key: string; label: string; icon: string };
export type NavSection = { key: string; label: string; icon: string; items: NavItem[] };

interface SidebarProps {
  sections:   NavSection[];
  activeItem: string;
  onNavigate: (key: string) => void;
  open:       boolean;
  onClose:    () => void;
  isMobile:   boolean;
}

export function Sidebar({ sections, activeItem, onNavigate, open, onClose, isMobile }: SidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ admin: true });
  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  return (
    <>
      {/* Mobile overlay */}
      {open && isMobile && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={onClose}
        />
      )}

      <aside
        className="fixed inset-y-0 left-0 z-50 flex flex-col flex-shrink-0 transition-all duration-200 overflow-hidden"
        style={{
          background: "linear-gradient(180deg, color-mix(in srgb, var(--sidebar-bg) 92%, white 8%) 0%, var(--sidebar-bg) 100%)",
          borderRight: open ? "1px solid var(--sidebar-border)" : "none",
          boxShadow: open ? "var(--sidebar-shadow)" : "none",
          width: open ? 240 : 0,
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center px-4 flex-shrink-0"
          style={{ height: "var(--header-height, 52px)", borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-base font-bold tracking-tight whitespace-nowrap" style={{ color: "var(--sidebar-text-hover)" }}>
              iSolutions
            </span>
            <button onClick={onClose} style={{ color: "var(--sidebar-text)", padding: 4 }}>
              <Icon name="x" size={17} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 text-sm">
          {sections.map(section => (
            <div key={section.key} className="mb-1">
              {/* Section header */}
              <button
                onClick={() => toggle(section.key)}
                className="w-full flex items-center gap-2 px-4 py-2 transition-colors"
                style={{ color: "var(--sidebar-section)", paddingTop: 10, paddingBottom: 10 }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--sidebar-text-hover)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--sidebar-section)")}
              >
                <Icon name={section.icon} size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left font-medium text-xs uppercase tracking-wider whitespace-nowrap">
                  {section.label}
                </span>
                <Icon name={expanded[section.key] ? "chevDown" : "chevRight"} size={13} />
              </button>

              {/* Items */}
              {expanded[section.key] && section.items.map(item => {
                const isActive = activeItem === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => { onNavigate(item.key); if (isMobile) onClose(); }}
                    className="w-full flex items-center gap-2.5 py-2 text-[13px] transition-colors"
                    style={{
                      marginLeft: 10,
                      marginRight: 10,
                      width: "calc(100% - 20px)",
                      paddingLeft: 14,
                      paddingRight: 14,
                      borderRadius: 10,
                      color:      isActive ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                      background: isActive ? "var(--sidebar-active-bg)"  : "transparent",
                      border: isActive ? "1px solid rgba(255,255,255,0.16)" : "1px solid transparent",
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.color      = "var(--sidebar-text-hover)";
                        e.currentTarget.style.background = "var(--sidebar-item-hover)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.color      = "var(--sidebar-text)";
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <Icon name={item.icon} size={13} className="flex-shrink-0" />
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
