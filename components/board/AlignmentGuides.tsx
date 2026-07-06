"use client";

import { useCanvas } from "./CanvasProvider";
import type { SnapGuide } from "@/lib/snap";

/**
 * Alignment guides rendered as SVG inside the world container so they
 * scale + translate with the camera. Up to two per axis (vertical + horizontal),
 * each one a solid 2px line in the accent color with a soft glow.
 *
 * The drag loop updates `guidesRef.current.v` and `guidesRef.current.h` paths
 * imperatively (we avoid React re-renders at 60fps during drag).
 */
export function AlignmentGuides() {
  const ctx = useCanvas();
  return (
    <svg
      ref={(el) => {
        ctx.guidesRef.current.svg = el;
      }}
      aria-hidden
      width={0}
      height={0}
      className="absolute top-0 left-0 overflow-visible pointer-events-none"
      style={{ zIndex: 9996 }}
    >
      {/* Vertical guides (alignment along X) */}
      <path
        ref={(el) => {
          ctx.guidesRef.current.v = el;
        }}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        style={{ display: "none", filter: "drop-shadow(0 0 4px var(--accent))" }}
      />
      {/* Horizontal guides (alignment along Y) */}
      <path
        ref={(el) => {
          ctx.guidesRef.current.h = el;
        }}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        style={{ display: "none", filter: "drop-shadow(0 0 4px var(--accent))" }}
      />
    </svg>
  );
}

/**
 * Format guides into SVG `d` attributes. Returns an object with the path
 * strings for the vertical and horizontal axes.
 */
export function formatGuidePaths(
  guides: SnapGuide[],
): { v: string; h: string } {
  let v = "";
  let h = "";
  for (const g of guides) {
    if (g.axis === "v") {
      v += `M ${g.pos} ${g.start} L ${g.pos} ${g.end} `;
    } else {
      h += `M ${g.start} ${g.pos} L ${g.end} ${g.pos} `;
    }
  }
  return { v: v.trim(), h: h.trim() };
}