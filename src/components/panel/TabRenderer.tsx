"use client";

import { useState, useEffect } from "react";
import type { TabDef } from "@/platform/core/TabDef";
import type { PanelDef } from "@/platform/core/PanelDef";

interface TabRendererProps {
  tabs: TabDef[];
  panel: PanelDef;
}

export function TabRenderer({ tabs, panel }: TabRendererProps) {
  const visible = tabs.filter(t => !t.hidden);
  const [activeKey, setActiveKey] = useState(panel.activeTabKey || visible[0]?.key || "");
  const [, setTick] = useState(0);

  useEffect(() => {
    panel.onFocusTab = (index: number) => {
      const tab = visible[index];
      if (tab) {
        setActiveKey(tab.key);
        panel.activeTabKey = tab.key;
        setTick(t => t + 1);
      }
    };
    return () => { panel.onFocusTab = null; };
  }, [panel]);

  const activeTab = visible.find(t => t.key === activeKey) ?? visible[0];

  if (!visible.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {visible.length > 1 && (
        <div style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--border)",
          marginBottom: "1rem",
          paddingBottom: 0,
        }}>
          {visible.map(tab => {
            const isActive = tab.key === activeKey;
            return (
              <button key={tab.key} onClick={() => { setActiveKey(tab.key); panel.activeTabKey = tab.key; }} style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "10px 12px",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
                marginBottom: -1,
              }}>
                {tab.getLabel() || tab.key}
                {tab.hasError && (
                  <span style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--danger-text, #e53e3e)",
                    flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab?.children
          .filter(c => !c.hidden)
          .map(child => child.show())
        }
      </div>
    </div>
  );
}
