"use client";

import { useState, useEffect } from "react";
import { PanelToolbar } from "./PanelToolbar";
import { TabRenderer } from "./TabRenderer";
import type { EditPanel } from "@/platform/core/EditPanel";
import type { Row } from "@/platform/core/types";
import { KeyPanel } from "./KeyPanel";

interface EditPanelRendererProps {
  panel: EditPanel;
}

export function EditPanelRenderer({ panel }: EditPanelRendererProps) {
  const [currentRecord, setCurrentRecord] = useState<Row | null>(panel.currentRecord);
  const [isDirty,       setIsDirty]       = useState(panel.isDirty);
  const [isNew,         setIsNew]         = useState(panel.isNew);
  // tick forces re-render of field values after display()/newRecord()/copyRecord()
  const [tick,          setTick]          = useState(0);

  // Wire direct callbacks — no pub/sub needed
  useEffect(() => {
    const handleDisplay = (row: Row | null) => {
      setCurrentRecord(row);
      setIsNew(panel.isNew);
      setIsDirty(panel.isDirty);
      setTick(t => t + 1);
    };
    panel.addDisplayListener(handleDisplay);
    panel.onDirtyChanged = (dirty) => {
      setIsDirty(dirty);
    };
    return () => {
      panel.removeDisplayListener(handleDisplay);
      panel.onDirtyChanged = null;
    };
  }, [panel]);

  // Show the form when isNew (no currentRecord yet but we have fields to fill)
  const showForm = !!currentRecord || isNew;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--bg-surface)" }}>

      <PanelToolbar
        toolbar={panel.toolbar}
        isNew={isNew}
        isDirty={isDirty}
        readOnly={panel.readOnly}
      />

      {panel.headerRenderer({ currentRecord, isNew })}

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
