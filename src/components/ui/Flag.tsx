"use client";

import { Icon } from "@/components/icons/Icon";

/**
 * Flag — renders an SVG flag from raw SVG string (stored in locales.flag_svg).
 * Falls back to a globe icon if no SVG provided.
 */
export function Flag({ svg, size = 18 }: { svg?: string | null; size?: number }) {
  const h = size;
  const w = Math.round(h * 1.4);
  const r = Math.round(h * 0.15);

  if (!svg) return <Icon name="globe" size={size - 2} />;

  // Inject width="100%" height="100%" so the SVG fills its container
  const sized = svg.replace("<svg ", '<svg width="100%" height="100%" ');

  return (
    <span
      className="inline-flex flex-shrink-0"
      style={{ lineHeight: 0, width: w, height: h, borderRadius: r, overflow: "hidden", display: "inline-flex" }}
      dangerouslySetInnerHTML={{ __html: sized }}
    />
  );
}
