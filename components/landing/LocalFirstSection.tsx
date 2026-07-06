import { ShieldIcon } from "@/components/ui/icons";

const POINTS = [
  {
    title: "Everything stays in your browser",
    text: "Boards live in localStorage. There is no account, no server, no telemetry.",
  },
  {
    title: "Zero network calls — verifiably",
    text: "Open the Network tab: after load, nothing moves. A strict Content-Security-Policy (connect-src 'self') makes it a guarantee, not a promise.",
  },
  {
    title: "Your data is portable",
    text: "Export the whole workspace as JSON anytime; imports are validated, clamped and sanitized before a single byte touches your board.",
  },
  {
    title: "AI backend is opt-in, later",
    text: "Today's AI features run as deterministic local heuristics. When you connect a backend, it's an explicit switch — never a silent default.",
  },
];

export function LocalFirstSection() {
  return (
    <section className="px-6 py-20 max-w-4xl mx-auto">
      <div className="glass-strong rounded-[28px] p-8 sm:p-10">
        <div className="flex items-center gap-3">
          <span
            className="w-11 h-11 rounded-2xl inline-flex items-center justify-center
              text-white bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]"
          >
            <ShieldIcon size={20} />
          </span>
          <h2 className="text-[clamp(22px,3.5vw,30px)] font-bold tracking-tight">
            Nothing leaves your browser.
          </h2>
        </div>
        <div className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-5">
          {POINTS.map((p) => (
            <div key={p.title}>
              <div className="text-[14px] font-semibold tracking-tight">
                {p.title}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
                {p.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
