"use client";

import { useEffect, useRef } from "react";

/**
 * ASCII flow field. A stationary grid of cells samples a slow time-varying
 * vector field; each cell renders a glyph from a density ramp based on local
 * field intensity, so the pattern breathes — sparse in calm regions, denser
 * along moving fronts. The cursor raises local intensity, morphing glyphs up
 * the ramp around it. Deliberately quiet: max alpha stays low so body text
 * always wins.
 *
 * Reduced motion: one static frame of the same field, no cursor tracking.
 */

const CELL = 22;
// Density ramp — leading spaces make calm regions genuinely empty, which is
// what gives the field its shape (uniform dots read as noise).
const RAMP = [" ", " ", "·", "·", ":", "-", "+", "*"];

export function AsciiBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;

    function resize() {
      const c = canvasRef.current;
      if (!c || !ctx) return;
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      width = window.innerWidth;
      height = window.innerHeight;
      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
    }

    resize();

    let mouseX = -9999;
    let mouseY = -9999;
    const onMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const onLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize);

    function drawFrame(timeMs: number) {
      if (!ctx) return;
      const t = timeMs * 0.00012;
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${CELL - 6}px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      const hasMouse = !reduced && mouseX > -9000;

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const x = gx * CELL;
          const y = gy * CELL;

          // Two-octave pseudo-curl field: cheap, smooth, never repeats
          // visibly. fx/fy in roughly [-2, 2].
          const fx =
            Math.sin(y * 0.011 + t * 2.1) +
            Math.sin((x + y) * 0.006 - t * 1.3);
          const fy =
            Math.cos(x * 0.009 - t * 1.7) +
            Math.cos((x - y) * 0.007 + t);

          let intensity = (fx * fx + fy * fy) / 8; // 0..1

          if (hasMouse) {
            const d = Math.hypot(x - mouseX, y - mouseY);
            if (d < 150) {
              intensity += (1 - d / 150) * 0.85;
            }
          }

          const idx = Math.min(
            RAMP.length - 1,
            Math.floor(Math.max(0, intensity) * RAMP.length),
          );
          const ch = RAMP[idx];
          if (ch === " ") continue;

          const alpha = Math.min(0.16, 0.05 + intensity * 0.09);
          ctx.fillStyle = `rgba(140, 140, 160, ${alpha.toFixed(3)})`;
          // Sway with the field so fronts visibly travel.
          ctx.fillText(ch, x + fx * 2.5, y + fy * 2.5);
        }
      }
    }

    let raf = 0;
    function loop(now: number) {
      drawFrame(now);
      raf = requestAnimationFrame(loop);
    }

    if (reduced) {
      drawFrame(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
