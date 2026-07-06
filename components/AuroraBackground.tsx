/**
 * Animated aurora backdrop. Four radial-gradient blobs on slow, mismatched
 * transform loops (compositor-only) plus an SVG turbulence grain overlay to
 * kill gradient banding. Zero JS at runtime; freezes under reduced motion.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="aurora-blob aurora-blob-4" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: GRAIN,
          opacity: 0.035,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}
