"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { DataPublisher } from "@/hooks/useLink";
import { useLink } from "@/hooks/useLink";
import type { CrudPanelRef } from "@/components/panels/CrudPanelContext";

// ── localStorage helpers ──
function getExpanded(table: string): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(`crud-expanded-${table}`) === "1"; } catch { return false; }
}
function saveExpanded(table: string, v: boolean) {
  try { localStorage.setItem(`crud-expanded-${table}`, v ? "1" : "0"); } catch {}
}

export interface UseCrudLinkOptions {
  /** API path for deep-link row fetch */
  apiPath: string;
  /** Table name — used to persist expanded/collapsed state */
  table: string;
  /** Navigation callback from parent */
  onNavigate: (k: string, oid?: string) => void;
  /** Deep-link: oid to select on mount */
  selectRecordOid?: string;
  /** Deep-link: sequence counter to re-trigger */
  selectSeq?: number;
}

export function useCrudLink({ apiPath, table, onNavigate, selectRecordOid, selectSeq }: UseCrudLinkOptions) {
  // ── Refs ──
  const gridRef = useRef<DataPublisher>(null);
  const crudRef = useRef<CrudPanelRef>(null);

  // ── Link ──
  const link = useLink(gridRef, crudRef);

  // ── Layout state (persisted per table) ──
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [showDetail, setShowDetail] = useState(() => getExpanded(table));

  // Persist when it changes
  useEffect(() => { saveExpanded(table, showDetail); }, [table, showDetail]);

  // Fetch required fields from API on mount
  useEffect(() => {
    fetch(`${apiPath}${apiPath.includes("?") ? "&" : "?"}limit=0`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.requiredFields)) setRequiredFields(data.requiredFields); })
      .catch(() => {});
  }, [apiPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show detail when record selected or creating new
  useEffect(() => {
    if (link.selectedId || link.isNew) setShowDetail(true);
  }, [link.selectedId, link.isNew]);

  // ── Deep link ──
  useEffect(() => {
    if (!selectRecordOid) return;
    fetch(`${apiPath}${apiPath.includes("?") ? "&" : "?"}oid=${encodeURIComponent(selectRecordOid)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        const row = data.rows?.[0];
        if (row) link.onSelect(row.oid, row);
      });
  }, [selectSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Nav guard ──
  const guardedNavigate = useCallback(async (k: string, oid?: string) => {
    if (crudRef.current) {
      const ok = await crudRef.current.canRelease();
      if (!ok) return;
    }
    onNavigate(k, oid);
  }, [onNavigate]);

  // ── Mobile back ──
  const handleBack = useCallback(() => setShowDetail(false), []);

  // ── Wrapped onDeleted that also hides detail ──
  const onDeletedMobile = useCallback(() => {
    link.onDeleted();
    setShowDetail(false);
  }, [link.onDeleted]);

  return {
    gridRef,
    crudRef,
    link,
    showDetail,
    setShowDetail,
    guardedNavigate,
    handleBack,
    onDeletedMobile,
    requiredFields,
  };
}
