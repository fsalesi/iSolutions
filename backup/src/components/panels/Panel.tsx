"use client";

import type { ReactNode } from "react";

/**
 * Panel — base container component.
 *
 * All panel types inherit from this. Currently a stub that renders children.
 * May gain shared behavior later (loading states, error boundaries, etc.)
 */
export interface PanelProps {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Panel({ children, className, style }: PanelProps) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
