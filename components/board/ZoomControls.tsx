"use client";

import { useEffect, useState } from "react";
import { useCanvas } from "./CanvasProvider";
import { FitIcon } from "@/components/ui/icons";

export function ZoomControls() {
  const ctx = useCanvas();
  const [pct, setPct] = useState(() =>
    Math.round(ctx.cameraRef.current.s * 100),
  );

  useEffect(() => {
    const listener = (cam: { s: number }) => setPct(Math.round(cam.s * 100));
    ctx.cameraListeners.add(listener);
    return () => {
      ctx.cameraListeners.delete(listener);
    };
  }, [ctx]);

  const btn =
    "w-8 h-8 inline-flex items-center justify-center text-[13px] font-medium " +
    "text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[var(--accent-soft)] rounded-md";

  return (
    <div
      className="glass-strong absolute bottom-5 right-16 z-40 rounded-lg p-0.5
        flex items-center"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Zoom out"
        className={btn}
        onClick={() => ctx.zoomBy(1 / 1.25)}
      >
        −
      </button>
      <button
        type="button"
        aria-label="Reset zoom to 100%"
        title="Reset to 100%"
        onClick={() => ctx.zoomBy(1 / ctx.cameraRef.current.s)}
        className="h-8 px-1.5 text-[11.5px] font-medium text-[var(--ink-faint)]
          hover:text-[var(--ink)] tabular-nums min-w-11"
      >
        {pct}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        className={btn}
        onClick={() => ctx.zoomBy(1.25)}
      >
        +
      </button>
      <div className="w-px h-4 mx-0.5 bg-[var(--border)]" />
      <button
        type="button"
        aria-label="Fit to content"
        title="Fit to content (F)"
        className={btn}
        onClick={() => ctx.fitToContent()}
      >
        <FitIcon size={14} />
      </button>
    </div>
  );
}
