"use client";

import { createContext, useContext, useRef, useCallback, useEffect, useId } from "react";

/**
 * Ref interface exposed by every CrudPanel via forwardRef + useImperativeHandle.
 */
export interface CrudPanelRef {
  /** Can this panel (and all descendants) safely release their current row? */
  canRelease(): Promise<boolean>;
}

/**
 * Context published by each CrudPanel so children can register themselves.
 * This enables the dirty-cascade pattern: a parent CrudPanel can ask all
 * descendant CrudPanels whether they have unsaved changes before allowing
 * a row switch.
 */
export interface CrudPanelContextValue {
  registerChild: (id: string, ref: CrudPanelRef) => void;
  unregisterChild: (id: string) => void;
}

export const CrudPanelContext = createContext<CrudPanelContextValue | null>(null);

/**
 * Hook for a CrudPanel to manage its children's registrations.
 * Returns the context value to publish AND a function to ask all children canRelease().
 */
export function useChildRegistry() {
  const childrenRef = useRef<Map<string, CrudPanelRef>>(new Map());

  const registerChild = useCallback((id: string, ref: CrudPanelRef) => {
    childrenRef.current.set(id, ref);
  }, []);

  const unregisterChild = useCallback((id: string) => {
    childrenRef.current.delete(id);
  }, []);

  /** Ask every registered child if it can release. Returns false if ANY child says no. */
  const canReleaseChildren = useCallback(async (): Promise<boolean> => {
    for (const [, ref] of childrenRef.current) {
      const ok = await ref.canRelease();
      if (!ok) return false;
    }
    return true;
  }, []);

  const contextValue: CrudPanelContextValue = { registerChild, unregisterChild };

  return { contextValue, canReleaseChildren };
}

/**
 * Hook for a CrudPanel to register itself with a parent CrudPanel's context.
 * Call this inside any CrudPanel that might be nested inside another.
 * Pass the CrudPanelRef that exposes canRelease().
 */
export function useRegisterWithParent(ref: CrudPanelRef) {
  const parentCtx = useContext(CrudPanelContext);
  const id = useId();

  useEffect(() => {
    if (!parentCtx) return;
    parentCtx.registerChild(id, ref);
    return () => parentCtx.unregisterChild(id);
  }, [parentCtx, id, ref]);
}
