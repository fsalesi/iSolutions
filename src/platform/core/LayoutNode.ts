import type { ReactNode } from "react";

/**
 * Renderable — the contract every node in the page tree must satisfy.
 * DataGridDef, PanelDef, layout presets, custom classes — all implement this.
 */
export interface Renderable {
  render(): ReactNode;
}

// ─── LeafNode ────────────────────────────────────────────────────────────────

/**
 * LeafNode — a terminal node in the layout tree.
 * Holds one Renderable (grid, panel, custom component, etc).
 * The preset creates the leaf; the page drops content into it.
 */
export class LeafNode implements Renderable {
  content: Renderable | null = null;

  render(): ReactNode {
    return this.content?.render() ?? null;
  }
}

// ─── SplitNode ───────────────────────────────────────────────────────────────

export interface SplitNodeOptions {
  direction: "horizontal" | "vertical";
  sizes:     [number, number];
  children:  [LeafNode | SplitNode, LeafNode | SplitNode];
  minSizes?: [number, number];
  /** Called by LayoutRenderer when user finishes a drag. */
  onChange?: (sizes: [number, number]) => void;
}

/**
 * SplitNode — divides its space into exactly two children with a draggable divider.
 * Carries its own onChange callback so the owning preset can persist sizes.
 */
export class SplitNode {
  direction: "horizontal" | "vertical";
  sizes:     [number, number];
  children:  [LeafNode | SplitNode, LeafNode | SplitNode];
  minSizes:  [number, number];
  onChange?: (sizes: [number, number]) => void;

  constructor(options: SplitNodeOptions) {
    this.direction = options.direction;
    this.sizes     = options.sizes;
    this.children  = options.children;
    this.minSizes  = options.minSizes ?? [80, 80];
    this.onChange  = options.onChange;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LS_PREFIX = "isolutions.layout.";

export function loadSizes(key: string, defaults: [number, number]): [number, number] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) return parsed as [number, number];
  } catch { /* ignore */ }
  return defaults;
}

export function saveSizes(key: string, sizes: [number, number]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(sizes));
  } catch { /* ignore */ }
}
