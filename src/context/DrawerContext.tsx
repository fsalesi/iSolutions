// ═══════════════════════════════════════════════════════════════════════════════
// DrawerContext.tsx — Panel Stack for Nested Slide-In Panels
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { DrawerService } from "@/platform/core/DrawerService";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DrawerEntry {
  id: string;
  panel: any;
}

export interface DrawerContextValue {
  stack: DrawerEntry[];
  push: (panel: any) => void;
  pop: () => void;
  clear: () => void;
  has: (panel: any) => boolean;
  depth: (panel: any) => number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const DrawerContext = createContext<DrawerContextValue | null>(null);

let nextDrawerId = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<DrawerEntry[]>([]);

  const push = useCallback((panel: any) => {
    setStack(prev => {
      const panelKey = panel?.drawerKey ?? panel;
      const topKey = prev.length > 0 ? (prev[prev.length - 1].panel?.drawerKey ?? prev[prev.length - 1].panel) : null;
      if (prev.length > 0 && topKey === panelKey) {
        return [...prev.slice(0, -1), { id: `drawer-${nextDrawerId++}`, panel }];
      }
      const filtered = prev.filter(e => (e.panel?.drawerKey ?? e.panel) !== panelKey);
      return [...filtered, { id: `drawer-${nextDrawerId++}`, panel }];
    });
  }, []);

  const pop = useCallback(() => {
    setStack(prev => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const clear = useCallback(() => {
    setStack([]);
  }, []);

  const has = useCallback((panel: any) => {
    return stack.some(e => e.panel === panel);
  }, [stack]);

  const depth = useCallback((panel: any) => {
    return stack.findIndex(e => e.panel === panel);
  }, [stack]);

  // Register with DrawerService so non-React code can push panels
  useEffect(() => {
    DrawerService.register(push, pop, clear);
    return () => DrawerService.unregister();
  }, [push, pop, clear]);

  return (
    <DrawerContext.Provider value={{ stack, push, pop, clear, has, depth }}>
      {children}
    </DrawerContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return ctx;
}

export function useDrawerOptional(): DrawerContextValue | null {
  return useContext(DrawerContext);
}
