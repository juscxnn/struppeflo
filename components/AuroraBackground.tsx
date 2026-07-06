/**
 * Static page backdrop: a hairline grid fading out from the top plus a very
 * faint accent glow. Deliberately calm — no animation, no blur.
 * (File name kept from the earlier design so imports stay stable.)
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <div className="absolute inset-0 page-grid" />
      <div className="absolute inset-0 page-glow" />
    </div>
  );
}
