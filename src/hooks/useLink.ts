"use client";

import { useState, useCallback, type RefObject } from "react";

// ── Interfaces ──
// These are component-agnostic. DataGrid satisfies DataPublisher,
// CrudPanel satisfies DataConsumer, but the link doesn't know that.

export interface DataPublisher {
  refresh: () => void;
}

export interface DataConsumer {
  canRelease: () => Promise<boolean>;
}

export interface LinkState {
  /** The currently selected row (full record), or null */
  selectedRow: Record<string, any> | null;
  /** The currently selected oid, or null */
  selectedId: string | null;
  /** True when creating a new record */
  isNew: boolean;
  /** Give to publisher's onSelect prop */
  onSelect: (oid: string, row: Record<string, any>) => void;
  /** Trigger new-record mode */
  onNew: () => void;
  /** Consumer calls after successful save */
  onSaved: (savedRow: Record<string, any>) => void;
  /** Consumer calls after successful delete */
  onDeleted: () => void;
}

/**
 * useLink — connects a data publisher (e.g. DataGrid) to a data consumer (e.g. CrudPanel).
 *
 * Holds selection state. Coordinates dirty guards via canRelease().
 * The hook is component-agnostic — it only knows about the publisher/consumer interfaces.
 *
 * @param publisherRef - ref to a DataPublisher (exposes refresh())
 * @param consumerRef  - ref to a DataConsumer (exposes canRelease())
 */
export function useLink(
  publisherRef: RefObject<DataPublisher | null>,
  consumerRef: RefObject<DataConsumer | null>,
): LinkState {
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  // ── onSelect: user clicked a row in the publisher ──
  const onSelect = useCallback(async (oid: string, row: Record<string, any>) => {
    // Ask consumer if it can release current record
    if (consumerRef.current) {
      const ok = await consumerRef.current.canRelease();
      if (!ok) return; // consumer said no (dirty, user cancelled)
    }
    setSelectedId(oid);
    setSelectedRow(row);
    setIsNew(false);
  }, [consumerRef]);

  // ── onNew: create a new record ──
  const onNew = useCallback(async () => {
    // Ask consumer if it can release current record
    if (consumerRef.current) {
      const ok = await consumerRef.current.canRelease();
      if (!ok) return;
    }
    setSelectedId(null);
    setSelectedRow(null);
    setIsNew(true);
  }, [consumerRef]);

  // ── onSaved: consumer saved successfully ──
  const onSaved = useCallback((savedRow: Record<string, any>) => {
    // Update selection to the saved row
    setSelectedRow(savedRow);
    setSelectedId(savedRow.oid || null);
    setIsNew(false);
    // Tell publisher to refresh its data
    publisherRef.current?.refresh();
  }, [publisherRef]);

  // ── onDeleted: consumer deleted the record ──
  const onDeleted = useCallback(() => {
    // Clear selection
    setSelectedRow(null);
    setSelectedId(null);
    setIsNew(false);
    // Tell publisher to refresh its data
    publisherRef.current?.refresh();
  }, [publisherRef]);

  return { selectedRow, selectedId, isNew, onSelect, onNew, onSaved, onDeleted };
}
