import type { ReactNode } from "react";
import { getLayoutSizes, setLayoutSizes } from "./FormsStorage";

/**
 * Showable — the contract for any content that can be placed in a LeafNode.
 * DataGridDef, EditPanel, custom classes — all implement show().
 */
export interface Showable {
  show(): ReactNode;
}

// ——— LeafNode ————————————————————————————————————————————————————————

/**
 * LeafNode — a terminal node in the layout tree.
 * Holds one Showable (grid, panel, custom component, etc).
 * The preset creates the leaf; the page drops content into it.
 */
export class LeafNode implements Showable {
  content: Showable | null = null;

  show(): ReactNode {
    return this.content?.show() ?? null;
  }
}

// ——— SplitNode ———————————————————————————————————————————————————————

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

// ——— Helpers —————————————————————————————————————————————————————————

export function loadSizes(key: string, defaults: [number, number]): [number, number] {
  if (typeof window === "undefined") return defaults;
  const formKey = key.split(".")[0] || key;
  const sizes = getLayoutSizes(formKey, key);
  return sizes ?? defaults;
}

export function saveSizes(key: string, sizes: [number, number]): void {
  if (typeof window === "undefined") return;
  const formKey = key.split(".")[0] || key;
  setLayoutSizes(formKey, key, sizes);
}
