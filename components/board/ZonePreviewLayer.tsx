"use client";

import { useEffect, useState } from "react";
import { useCanvas } from "./CanvasProvider";
import type { ZonePreview } from "./CanvasProvider";

/**
 * World-space SVG that previews where a zone will land after the user
 * drops a card into it. Shows the post-fit size as a dashed accent rect,
 * with a soft glow and a member-count chip.
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
        animation: "zone-preview-in 120ms ease-out both",
      }}
    >
      {/* Soft glow halo */}
      <rect
        x={preview.rect.x - 4}
        y={preview.rect.y - 4}
        width={preview.rect.w + 8}
        height={preview.rect.h + 8}
        rx={20}
        ry={20}
        fill="var(--accent)"
        opacity={0.08}
        style={{ pointerEvents: "none" }}
      />
      {/* The preview rect itself — dashed accent */}
      <rect
        x={preview.rect.x}
        y={preview.rect.y}
        width={preview.rect.w}
        height={preview.rect.h}
        rx={16}
        ry={16}
        fill="var(--accent-soft)"
        fillOpacity={0.6}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeDasharray="6 4"
        style={{ pointerEvents: "none" }}
      />
      {/* Member-count chip */}
      <g
        transform={`translate(${preview.rect.x + 12}, ${preview.rect.y + preview.rect.h - 14})`}
        style={{ pointerEvents: "none" }}
      >
        <rect
          x={-4}
          y={-11}
          width={badgeWidth(preview.memberCount) + 8}
          height={22}
          rx={11}
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth={1.5}
        />
        <text
          x={0}
          y={0}
          dominantBaseline="central"
          fontSize={11.5}
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
  const digits = String(count).length;
  return 4 + digits * 7 + 32;
}