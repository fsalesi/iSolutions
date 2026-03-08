import { LeafNode, SplitNode, loadSizes, saveSizes } from "../LayoutNode";

export interface VerticalLayoutOptions {
  sizes?:    [number, number];
  minSizes?: [number, number];
}

/**
 * VerticalLayout — top / bottom split.
 * Default sizes: 50/50.
 */
export class VerticalLayout {
  top    = new LeafNode();
  bottom = new LeafNode();
  root:   SplitNode;

  constructor(key: string, options: VerticalLayoutOptions = {}) {
    const sizes = loadSizes(key, options.sizes ?? [50, 50]);
    this.root = new SplitNode({
      direction: "vertical",
      sizes,
      children:  [this.top, this.bottom],
      minSizes:  options.minSizes,
      onChange:  (s) => saveSizes(key, s),
    });
  }
}
