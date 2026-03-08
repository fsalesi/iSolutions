// ChildElement.ts — Interface every tree node implements

import type { Row } from "./types";

export type ChildElementType = "field" | "tab" | "section" | "grid" | "custom";

export interface ChildElement {
  readonly type: ChildElementType;
  key: string;
  hidden: boolean;

  // Called by parent during the display cascade.
  // Fields extract row[this.key].
  // Sections/Tabs forward to their children.
  // Grids filter and fetch their own data.
  display(row: Row | null): void;
}
