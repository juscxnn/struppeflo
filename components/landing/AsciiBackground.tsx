"use client";

import { useEffect, useRef } from "react";

/**
 * Dense, interactive ASCII flow field. A grid of monospace characters drift
 * across the screen in a base direction; the cursor applies a radial force
 * field that bends the flow around it. Color and character weight track
 * local velocity.
 *
 * Reduced-motion: a static grid, no animation, no cursor interaction.
 */

const CELL = 22; // px — sparser, calmer
const CHARS = "·.,·";
const POOL = CHARS.split("");

interface Particle {
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  ch: string;
  phase: number;
}

function randomChar(): string {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

export function AsciiBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dpr = Math.max(1, window.devicePixelRatio || 1);
    let width = window.innerWidth;
    let height = window.innerHeight;
    let cols = Math.ceil(width / CELL);
    let rows = Math.ceil(height / CELL);
    let particles: Particle[] = [];

    function buildParticles() {
      particles = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          particles.push({
            baseX: x * CELL,
            baseY: y * CELL,
            vx: 0.06 + Math.random() * 0.04,
            vy: 0.02 + Math.random() * 0.02,
            ch: randomChar(),
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    function resize() {
      const c = canvasRef.current;
      const cx = ctxRef.current;
      if (!c || !cx) return;
      dpr = Math.max(1, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL);
      rows = Math.ceil(height / CELL);
      buildParticles();
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

    let raf = 0;
    function tick() {
      const cx = ctxRef.current;
      if (!cx) return;
      cx.clearRect(0, 0, width, height);
      cx.font = `${CELL - 6}px ui-monospace, "SF Mono", "Menlo", monospace`;
      cx.textBaseline = "middle";
      cx.textAlign = "center";

      for (const p of particles) {
        // Base drift, very slow and slightly diagonal.
        p.baseX += p.vx;
        p.baseY += p.vy;

        // Wrap around screen edges.
        if (p.baseX > width + CELL) p.baseX -= width + CELL;
        if (p.baseY > height + CELL) p.baseY -= height + CELL;

        // Subtle radial nudge toward cursor. Tiny radius, small force — this
        // is meant to be a breath of life, not a particle engine.
        let dx = 0;
        let dy = 0;
        if (!reduced && mouseX > -9000) {
          const rx = p.baseX - mouseX;
          const ry = p.baseY - mouseY;
          const dist = Math.hypot(rx, ry);
          const radius = 70;
          if (dist < radius && dist > 1) {
            const force = (1 - dist / radius) * 0.25;
            dx = (rx / dist) * force * 2;
            dy = (ry / dist) * force * 2;
          }
        }

        const x = p.baseX + dx;
        const y = p.baseY + dy;
        // Faint baseline alpha + tiny proximity bump. Never gets bright.
        let alpha = 0.07;
        if (!reduced && mouseX > -9000) {
          const d = Math.hypot(x - mouseX, y - mouseY);
          if (d < 90) {
            alpha = 0.07 + (1 - d / 90) * 0.08;
          }
        }
        cx.fillStyle = `rgba(140, 140, 160, ${alpha.toFixed(3)})`;
        cx.fillText(p.ch, x, y);
      }

      raf = requestAnimationFrame(tick);
    }

    if (reduced) {
      // Render one frame statically.
      const cx = ctxRef.current;
      if (!cx) return;
      cx.clearRect(0, 0, width, height);
      cx.font = `${CELL - 6}px ui-monospace, "SF Mono", "Menlo", monospace`;
      cx.textBaseline = "middle";
      cx.textAlign = "center";
      cx.fillStyle = "rgba(140, 140, 160, 0.07)";
      for (const p of particles) {
        cx.fillText(p.ch, p.baseX, p.baseY);
      }
    } else {
      raf = requestAnimationFrame(tick);
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