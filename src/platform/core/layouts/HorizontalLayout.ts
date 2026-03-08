import { LeafNode, SplitNode, loadSizes, saveSizes } from "../LayoutNode";

export interface HorizontalLayoutOptions {
  sizes?:    [number, number];
  minSizes?: [number, number];
}

/**
 * HorizontalLayout — left | right split.
 * Default sizes: 50/50.
 * Sizes auto-persist to localStorage under "isolutions.layout.{key}".
 *
 * Usage in a page:
 *   private layout = new HorizontalLayout("my_page")
 *   constructor() {
 *     this.layout.left.content  = this.grid
 *     this.layout.right.content = this.editPanel
 *   }
 *   render() { return <LayoutRenderer node={this.layout.root} /> }
 */
export class HorizontalLayout {
  left  = new LeafNode();
  right = new LeafNode();
  root:  SplitNode;

  constructor(key: string, options: HorizontalLayoutOptions = {}) {
    const sizes = loadSizes(key, options.sizes ?? [50, 50]);
    this.root = new SplitNode({
      direction: "horizontal",
      sizes,
      children:  [this.left, this.right],
      minSizes:  options.minSizes,
      onChange:  (s) => saveSizes(key, s),
    });
  }
}
