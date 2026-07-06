"use client";

import { useEffect, useState } from "react";
import { useCanvas } from "./CanvasProvider";
import type { ZonePreview } from "./CanvasProvider";

/**
 * World-space SVG rect that previews the zone a dragged card will adopt, at
 * the post-fit size computed from the prospective membership. Drawn dashed so
 * it reads as "this is what would happen" rather than a settled shape.
 *
 * Polls `previewZoneRef` via rAF — sets React state only when the
 * preview appears, disappears, or moves, so the SVG re-renders the same
 * rect a frame later but doesn't thrash on no-op updates.
 */
export function ZonePreviewLayer() {
  const ctx = useCanvas();
  const [preview, setPreview] = useState<ZonePreview | null>(null);

  useEffect(() => {
    let raf = 0;
    let lastKey: string | null = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = ctx.previewZoneRef.current;
      const key = p
        ? `${p.divisionId}|${p.rect.x}|${p.rect.y}|${p.rect.w}|${p.rect.h}|${p.memberCount}`
        : null;
      if (key !== lastKey) {
        lastKey = key;
        setPreview(p);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ctx]);

  if (!preview) return null;

  return (
    <g
      className="zone-preview"
      style={{
        animation: "zone-preview-in 150ms ease-out both",
      }}
    >
      <rect
        x={preview.rect.x}
        y={preview.rect.y}
        width={preview.rect.w}
        height={preview.rect.h}
        rx={16}
        ry={16}
        fill="var(--accent-soft)"
        fillOpacity={0.5}
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeDasharray="6 5"
        opacity={0.85}
        style={{ pointerEvents: "none" }}
      />
      <g
        transform={`translate(${preview.rect.x + 12}, ${preview.rect.y + preview.rect.h - 12})`}
        style={{ pointerEvents: "none" }}
      >
        <rect
          x={-6}
          y={-10}
          width={badgeWidth(preview.memberCount) + 12}
          height={20}
          rx={6}
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth={1}
        />
        <text
          x={0}
          y={0}
          dominantBaseline="central"
          fontSize={11}
          fontWeight={600}
          fill="var(--accent)"
          style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
        >
          {preview.memberCount} {preview.memberCount === 1 ? "card" : "cards"}
        </text>
      </g>
    </g>
  );
}

function badgeWidth(count: number): number {
  // Rough width estimate so the chip fits "N cards" / "N card".
  const digits = String(count).length;
  return 6 + digits * 6.5 + 30;
}
