// ═══════════════════════════════════════════════════════════════════════════════
// DrawerService.ts — Singleton for controlling the drawer from non-React code
// ═══════════════════════════════════════════════════════════════════════════════
//
// This allows PanelDef (a class, not a React component) to push itself onto
// the drawer stack. The DrawerRenderer wires itself to this service on mount.
//
// Usage in PanelDef:
//   if (this.displayMode === "slide-in-right") {
//     DrawerService.push(this);
//   }
//
// ═══════════════════════════════════════════════════════════════════════════════

export type DrawerPushFn = (panel: any) => void;
export type DrawerPopFn = () => void;
export type DrawerClearFn = () => void;

class DrawerServiceClass {
  private _push: DrawerPushFn | null = null;
  private _pop: DrawerPopFn | null = null;
  private _clear: DrawerClearFn | null = null;

  /** Called by DrawerProvider on mount to wire up the context functions */
  register(push: DrawerPushFn, pop: DrawerPopFn, clear: DrawerClearFn): void {
    this._push = push;
    this._pop = pop;
    this._clear = clear;
  }

  /** Called by DrawerProvider on unmount */
  unregister(): void {
    this._push = null;
    this._pop = null;
    this._clear = null;
  }

  /** Push a panel onto the drawer stack */
  push(panel: any): void {
    if (!this._push) {
      console.warn("DrawerService.push called but no DrawerProvider is mounted");
      return;
    }
    this._push(panel);
  }

  /** Pop the top panel off the stack */
  pop(): void {
    if (!this._pop) {
      console.warn("DrawerService.pop called but no DrawerProvider is mounted");
      return;
    }
    this._pop();
  }

  /** Clear all panels from the stack */
  clear(): void {
    if (!this._clear) {
      console.warn("DrawerService.clear called but no DrawerProvider is mounted");
      return;
    }
    this._clear();
  }
}

export const DrawerService = new DrawerServiceClass();
