import { LeafNode, SplitNode, loadSizes, saveSizes } from "../LayoutNode";

export interface ThreePanelLayoutOptions {
  /** Outer horizontal split — left vs right. Default: [75, 25] */
  outerSizes?: [number, number];
  /** Inner vertical split inside left pane — top vs bottom. Default: [60, 40] */
  innerSizes?: [number, number];
  outerMinSizes?: [number, number];
  innerMinSizes?: [number, number];
}

/**
 * ThreePanelLayout — left pane split top/bottom, right panel.
 *
 *  ┌──────────────┬───────┐
 *  │   topLeft    │       │
 *  ├──────────────┤ right │
 *  │  bottomLeft  │       │
 *  └──────────────┴───────┘
 *
 * Sizes persist:
 *   "{key}.outer" → horizontal (left vs right)
 *   "{key}.inner" → vertical (top vs bottom inside left)
 */
export class ThreePanelLayout {
  topLeft    = new LeafNode();
  bottomLeft = new LeafNode();
  right      = new LeafNode();
  root:       SplitNode;

  constructor(key: string, options: ThreePanelLayoutOptions = {}) {
    const outerSizes = loadSizes(`${key}.outer`, options.outerSizes ?? [75, 25]);
    const innerSizes = loadSizes(`${key}.inner`, options.innerSizes ?? [60, 40]);

    const innerSplit = new SplitNode({
      direction: "vertical",
      sizes:     innerSizes,
      children:  [this.topLeft, this.bottomLeft],
      minSizes:  options.innerMinSizes,
      onChange:  (s) => saveSizes(`${key}.inner`, s),
    });

    this.root = new SplitNode({
      direction: "horizontal",
      sizes:     outerSizes,
      children:  [innerSplit, this.right],
      minSizes:  options.outerMinSizes,
      onChange:  (s) => saveSizes(`${key}.outer`, s),
    });
  }
}
