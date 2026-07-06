"use client";

import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useCanvas } from "./CanvasProvider";
import { LinkPath } from "./LinkPath";

/**
 * One SVG overlay in world space for all links (it inherits the camera
 * transform from #world). Layered between divisions and cards.
 */
export function LinkLayer() {
  const ctx = useCanvas();
  const linkIds = useStore(
    ctx.store,
    useShallow((s) => Object.keys(s.boards[ctx.boardId]?.links ?? {})),
  );

  return (
    <svg
      aria-hidden
      width={0}
      height={0}
      className="absolute top-0 left-0 overflow-visible"
      style={{ pointerEvents: "none" }}
    >
      {linkIds.map((id) => (
        <LinkPath key={id} linkId={id} />
      ))}
      {/* Proximity ghost — driven imperatively by the ProximityEngine. */}
      <path
        ref={(el) => {
          ctx.ghostRef.current.path = el;
        }}
        className="ghost-link-path"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.6}
        style={{ display: "none", pointerEvents: "none" }}
      />
    </svg>
  );
}
