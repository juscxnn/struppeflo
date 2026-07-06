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

const CELL = 14; // px
const CHARS_LOW = "·.,'";
const CHARS_MID = "•o+x";
const CHARS_HIGH = "*#@";
const POOL = (CHARS_LOW + CHARS_MID + CHARS_HIGH).split("");

interface Particle {
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  ch: string;
}

function randomChar(): string {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

function pickCharBySpeed(speed: number): string {
  if (speed < 0.4) return CHARS_LOW[Math.floor(Math.random() * CHARS_LOW.length)];
  if (speed < 1.2)
    return CHARS_MID[Math.floor(Math.random() * CHARS_MID.length)];
  return CHARS_HIGH[Math.floor(Math.random() * CHARS_HIGH.length)];
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
            vx: 0.15 + Math.random() * 0.1,
            vy: 0.05 + Math.random() * 0.05,
            ch: randomChar(),
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
      cx.font = `${CELL - 2}px ui-monospace, "SF Mono", "Menlo", monospace`;
      cx.textBaseline = "middle";
      cx.textAlign = "center";
      cx.fillStyle = "rgba(120, 120, 130, 0.18)";

      for (const p of particles) {
        // Base drift, slightly diagonal.
        p.baseX += p.vx;
        p.baseY += p.vy;

        // Wrap around screen edges.
        if (p.baseX > width + CELL) p.baseX -= width + CELL;
        if (p.baseY > height + CELL) p.baseY -= height + CELL;

        // Cursor force: radial push away from cursor, falloff with distance.
        let dx = 0;
        let dy = 0;
        let speed = Math.hypot(p.vx, p.vy);
        if (!reduced && mouseX > -9000) {
          const rx = p.baseX - mouseX;
          const ry = p.baseY - mouseY;
          const dist = Math.hypot(rx, ry);
          const radius = 140;
          if (dist < radius && dist > 1) {
            const force = (1 - dist / radius) * 0.9;
            dx = (rx / dist) * force * 8;
            dy = (ry / dist) * force * 8;
            // Add momentum to vx/vy so the character accelerates.
            p.vx += (rx / dist) * force * 0.02;
            p.vy += (ry / dist) * force * 0.02;
            // Slow them back down so we don't blow up.
            p.vx *= 0.96;
            p.vy *= 0.96;
            // Pick a more agitated char to reflect the disturbance.
            speed = Math.hypot(p.vx, p.vy);
            p.ch = pickCharBySpeed(speed);
          }
        }

        const x = p.baseX + dx;
        const y = p.baseY + dy;
        // Slight color modulation: characters near cursor glow brighter.
        let alpha = 0.18;
        if (!reduced && mouseX > -9000) {
          const d = Math.hypot(x - mouseX, y - mouseY);
          if (d < 180) {
            alpha = 0.18 + (1 - d / 180) * 0.5;
          }
        }
        cx.fillStyle = `rgba(160, 160, 175, ${alpha.toFixed(3)})`;
        cx.fillText(p.ch, x, y);
      }

      raf = requestAnimationFrame(tick);
    }

    if (reduced) {
      // Render one frame statically.
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${CELL - 2}px ui-monospace, "SF Mono", "Menlo", monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(120, 120, 130, 0.18)";
      for (const p of particles) {
        ctx.fillText(p.ch, p.baseX, p.baseY);
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