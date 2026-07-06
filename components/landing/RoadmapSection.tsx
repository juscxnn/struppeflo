const ROADMAP = {
  now: [
    "Run with Claude, ChatGPT, Gemini, MiniMax, or Kimi",
    "Per-model system prompts and structured output",
    "Run output → board auto-split (close the loop)",
    "Thumbs feedback on run quality",
    "Opt-in structural telemetry under Help → Help improve",
  ],
  next: [
    "Share-link: read-only public boards",
    "Cloud sync across devices (Pro)",
    "Hosted backend — no BYOK required (Pro)",
    "Per-model cost estimate in Prompt X-Ray",
    "Prompt diff: see what changed since last edit",
  ],
  later: [
    "MCP server: boards as resources for Claude Desktop, Cursor, Windsurf",
    "Real-time collaboration on shared boards",
    "Team workspaces with SSO and seat management",
    "Templates marketplace with creator revenue share",
  ],
};

const ISSUE_URL =
  "https://github.com/juscxnn/struppeflo/issues/new?template=feature_request.md&title=";

export function RoadmapSection() {
  return (
    <section id="roadmap" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
            ROADMAP
          </div>
          <h2 className="mt-2 text-[clamp(22px,3.5vw,30px)] font-semibold tracking-tight max-w-xl">
            Building in public.
          </h2>
        </div>
        <a
          href={ISSUE_URL}
          target="_blank"
          rel="noopener"
          className="text-[12.5px] font-medium text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors inline-flex items-center gap-1"
        >
          Suggest a feature →
        </a>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-dim)] max-w-2xl">
        Open source under AGPL-3.0. Now / Next / Later is a snapshot — it
        shifts as we ship.
      </p>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <Column title="Now" items={ROADMAP.now} accent="var(--accent)" />
        <Column
          title="Next"
          items={ROADMAP.next}
          accent="var(--ink-faint)"
        />
        <Column
          title="Later"
          items={ROADMAP.later}
          accent="var(--ink-faint)"
        />
      </div>
    </section>
  );
}

function Column({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: string;
}) {
  return (
    <div className="glass rounded-xl p-5 flex flex-col">
      <div
        className="text-[11px] font-semibold tracking-[0.14em]"
        style={{ color: accent }}
      >
        {title.toUpperCase()}
      </div>
      <ul className="mt-3 flex flex-col gap-2.5 text-[13px] leading-relaxed text-[var(--ink-dim)]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-[var(--ink-faint)] shrink-0">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}