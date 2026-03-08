// ═══════════════════════════════════════════════════════════════════════════════
// ChildElement.ts — Interface every tree node implements
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every node in the form tree (Field, Section, Tab, Grid, Custom) implements this.
// The display() cascade propagates from PanelDef down through the entire tree.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from "react";
import type { Row } from "./types";

export type ChildElementType = "field" | "tab" | "section" | "grid" | "custom";

export interface ChildElement {
  readonly type: ChildElementType;
  key: string;
  hidden: boolean;

  /**
   * Render this element as React. Called during layout render cycle.
   */
  show(): ReactNode;

  /**
   * Called by parent during the display cascade.
   *
   * Fields: Extract row[this.key] and update internal value.
   * Sections/Tabs: Forward to all children.
   * Grids: Build filter from parent binding and fetch data (async).
   *
   * Return type is void | Promise<void> to allow async implementations.
   * Parent callers should NOT await — the cascade is fire-and-forget.
   * Async grids manage their own loading state and trigger re-renders via onFetch.
   */
  display(row: Row | null): void | Promise<void>;

  /**
   * Called when element should hide (stub for now).
   */
  hide(): void;

  /**
   * Called when element is being destroyed (stub for cleanup).
   */
  destroy(): void;
}
