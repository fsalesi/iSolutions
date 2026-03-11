"use client";

import { useState, useEffect } from "react";
import { PanelToolbar } from "./PanelToolbar";
import { TabRenderer } from "./TabRenderer";
import { Icon } from "@/components/icons/Icon";
import type { EditPanel } from "@/platform/core/EditPanel";
import { applyPanelLayoutToPanel, ensurePanelLayoutLoaded } from "@/platform/core/PanelLayoutRuntime";
import { DrawerService } from "@/platform/core/DrawerService";
import { FieldDesigner } from "@/platform/core/FieldDesigner";
import { SectionDesigner } from "@/platform/core/SectionDesigner";
import { TabDesigner } from "@/platform/core/TabDesigner";
import type { Row } from "@/platform/core/types";
import { useSession } from "@/context/SessionContext";

interface EditPanelRendererProps {
  panel: EditPanel;
}

type DesignTarget = {
  type: "tab" | "section" | "field";
  key: string;
  parentKey?: string;
};

export function EditPanelRenderer({ panel }: EditPanelRendererProps) {
  const { user } = useSession();
  const [currentRecord, setCurrentRecord] = useState<Row | null>(panel.currentRecord);
  const [isNew, setIsNew] = useState(panel.isNew);
  const [, setRenderTick] = useState(0);
  const [designMode, setDesignMode] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<DesignTarget | null>(null);

  useEffect(() => {
    void ensurePanelLayoutLoaded(panel).then(() => {
      applyPanelLayoutToPanel(panel);
      setRenderTick(t => t + 1);
    });

    const handleDisplay = (row: Row | null) => {
      setCurrentRecord(row);
      setIsNew(panel.isNew);
    };
    panel.addDisplayListener(handleDisplay);
    panel.onDirtyChanged = () => {
      setRenderTick(t => t + 1);
    };
    return () => {
      panel.removeDisplayListener(handleDisplay);
      panel.onDirtyChanged = null;
    };
  }, [panel]);

  const showForm = !!currentRecord || isNew;
  const designEnabled = !!user?.isAdmin;

  useEffect(() => {
    if (!designEnabled && designMode) {
      setDesignMode(false);
      setSelectedTarget(null);
    }
  }, [designEnabled, designMode]);

  const handleSelectTarget = (target: DesignTarget | null) => {
    setSelectedTarget(target);
    if (!designMode || !target) return;
    if (target.type === "field") {
      DrawerService.push(new FieldDesigner(panel, panel.getField(target.key)));
      return;
    }
    if (target.type === "section") {
      DrawerService.push(new SectionDesigner(panel, panel.getSection(target.key)));
      return;
    }
    if (target.type === "tab") {
      DrawerService.push(new TabDesigner(panel, panel.getTab(target.key)));
    }
  };

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--bg-surface)" }}>

      <PanelToolbar toolbar={panel.toolbar} designEnabled={designEnabled} />

      {designEnabled && (
        <div style={{ position: "absolute", top: 54, right: 12, zIndex: 3 }}>
          <button
            onClick={() => {
              setDesignMode(mode => {
                const next = !mode;
                if (!next) setSelectedTarget(null);
                return next;
              });
            }}
            title={designMode ? "Exit Panel Design Mode" : "Enter Panel Design Mode"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30, borderRadius: 999,
              border: `1px solid ${designMode ? "var(--accent)" : "var(--border)"}`,
              background: designMode ? "rgba(59,130,246,0.08)" : "var(--bg-surface)",
              color: designMode ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            <Icon name="settings" size={14} />
          </button>
        </div>
      )}


      {panel.headerRenderer()}

      <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        {!showForm ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.82rem" }}>
            Select a record to edit
          </div>
        ) : (
          <TabRenderer
            key={String(panel.displayNonce)}
            tabs={panel.tabs}
            panel={panel}
            designMode={designMode}
            selectedTarget={selectedTarget}
            onSelectTarget={handleSelectTarget}
          />
        )}
      </div>

    </div>
  );
}
