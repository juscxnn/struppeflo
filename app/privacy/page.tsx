export const metadata = {
  title: "Privacy — Struppëflo",
  description:
    "What Struppëflo collects by default, what it can collect if you opt in, and what it never sees.",
};

const TIERS = [
  {
    name: "Tier 0 — Always",
    subtitle: "No data ever leaves your browser.",
    rows: [
      ["Boards, cards, links, zones", "Stored in localStorage. Never sent anywhere."],
      ["AI provider keys", "Stored in localStorage. Sent only to the provider that owns the key."],
    ],
  },
  {
    name: "Tier 1 — Anonymous, no consent needed",
    subtitle: "Event names and small counts only. No content.",
    rows: [
      ["Page views and demo interactions", "Anonymous, via Vercel Analytics."],
      ["Product events", "brain_dump, organize, suggest_links, workflow_generated, template_used, xray_opened, prompt_copied, run_started, run_completed, open_in_claude, key_connected, tour_completed, waitlist_joined."],
      ["Per-run telemetry", "Provider, model, card count, input/output tokens, duration, status. Not the prompt content or output text."],
      ["Outcome feedback", "Thumbs up/down on run results. Optional one-line note (sent only when you submit it)."],
    ],
  },
  {
    name: "Tier 2 — Opt-in, structural only",
    subtitle: "Toggle in Help → Help improve Struppëflo. Default off. Never collects titles, bodies, or prompts.",
    rows: [
      ["Board structure", "Card type histogram, zone count, link type histogram, dependency depth."],
      ["Per-run outcomes", "Provider, model, prompt fingerprint (SHA-256 of compiled markdown, not the markdown itself), output length, thumbs rating."],
      ["Session shape", "How long you used the app, which features you used (event names only)."],
    ],
  },
  {
    name: "What we never see",
    subtitle: "Even with Tier 2 enabled.",
    rows: [
      ["Card titles, bodies, or prompt text", "Never collected at any tier."],
      ["Your AI provider keys", "Browser → provider direct; Struppëflo's servers never see them."],
      ["Your output text from runs", "Streamed in your browser; we only see length and your thumbs rating."],
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <main className="max-w-3xl mx-auto px-6 pt-24 pb-20">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
          PRIVACY
        </div>
        <h1 className="mt-2 text-[clamp(28px,4.5vw,40px)] font-semibold tracking-[-0.02em] leading-[1.1]">
          Local-first, by design.
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--ink-dim)] max-w-2xl">
          Struppëflo runs in your browser. Boards, cards, and AI keys never
          touch our servers. Below is exactly what gets sent, in which tier,
          and how to turn any of it off.
        </p>

        <div className="mt-10 flex flex-col gap-10">
          {TIERS.map((tier) => (
            <section key={tier.name}>
              <h2 className="text-[18px] font-semibold tracking-tight">
                {tier.name}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--ink-dim)]">
                {tier.subtitle}
              </p>
              <div className="mt-4 glass rounded-xl overflow-hidden">
                <table className="w-full text-[13px]">
                  <tbody>
                    {tier.rows.map(([label, value], i) => (
                      <tr
                        key={label}
                        className={
                          i < tier.rows.length - 1
                            ? "border-b border-[var(--border)]"
                            : ""
                        }
                      >
                        <td className="px-4 py-3 align-top font-medium w-[36%]">
                          {label}
                        </td>
                        <td className="px-4 py-3 align-top text-[var(--ink-dim)] leading-relaxed">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-12">
          <h2 className="text-[18px] font-semibold tracking-tight">
            Retention and access
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-dim)]">
            Tier 1 events are retained by our analytics provider for the
            standard Vercel Analytics window. Tier 2 telemetry is retained
            for 90 days and is used only in aggregate to inform product
            decisions. We do not sell or share either tier with third parties.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-[18px] font-semibold tracking-tight">Contact</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-dim)]">
            Questions, deletion requests, or concerns:{" "}
            <a
              href="mailto:privacy@struppeflo.app"
              className="font-medium text-[var(--ink)] underline"
            >
              privacy@struppeflo.app
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}