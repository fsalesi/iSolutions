"use client";

import { useState, useEffect } from "react";
import { PanelToolbar } from "./PanelToolbar";
import { TabRenderer } from "./TabRenderer";
import type { EditPanel } from "@/platform/core/EditPanel";
import type { Row } from "@/platform/core/types";

interface EditPanelRendererProps {
  panel: EditPanel;
}

export function EditPanelRenderer({ panel }: EditPanelRendererProps) {
  const [currentRecord, setCurrentRecord] = useState<Row | null>(panel.currentRecord);
  const [isNew, setIsNew] = useState(panel.isNew);
  const [, setRenderTick] = useState(0);

  useEffect(() => {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--bg-surface)" }}>

      <PanelToolbar
        toolbar={panel.toolbar}
      />

      {panel.headerRenderer()}

      <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        {!showForm ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.82rem" }}>
            Select a record to edit
          </div>
        ) : (
          <TabRenderer key="stable" tabs={panel.tabs} panel={panel} />
        )}
      </div>

    </div>
  );
}
