export const metadata = {
  title: "Privacy — Struppëflo",
  description:
    "What Struppëflo collects (anonymous structure and usage, never content), and what it never sees.",
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
      ["Product events", "brain_dump, organize, suggest_links, workflow_generated, template_used, xray_opened, prompt_copied, run_started, run_completed, open_in_model, key_connected, tour_completed, waitlist_joined, board_created_blank, result_added_to_board, result_split_into_cards, run_helpful_yes, run_helpful_no, telemetry_opt_in, telemetry_opt_out."],
      ["Per-run telemetry", "Provider, model, card count, input/output tokens, duration, status. Not the prompt content or output text."],
      ["Outcome feedback", "Thumbs up/down on run results. Optional one-line note (sent only when you submit it)."],
    ],
  },
  {
    name: "Tier 2 — Structural only, on by default",
    subtitle:
      "One-click off: Help → Help improve Struppëflo. You see a notice the first time you use the studio. Never collects titles, bodies, or prompts.",
    rows: [
      ["Board structure", "Card type histogram, zone count, link type histogram, dependency depth. Plus a sha256 fingerprint of the structural shape (not the text)."],
      ["Edit stream", "Each add/edit/remove event on cards, links, zones — with ms since the previous edit. Struggle signal: lots of edits before a run often means the prompt was hard to compose."],
      ["Per-run outcomes", "Provider, model, prompt fingerprint (sha256 of compiled markdown), output length, thumbs rating."],
      ["Run quality", "Did the user re-run the same prompt? Did they add the result to the board or split it into cards?"],
      ["Session", "Anonymous user id, start/end timestamps, edit count, run count, thumbs distribution, final structure."],
    ],
  },
  {
    name: "What we never see",
    subtitle: "Even with Tier 2 enabled.",
    rows: [
      ["Card titles, bodies, or prompt text", "Never collected at any tier. Server route's zod schema rejects these fields."],
      ["Your AI provider keys", "Browser → provider direct; Struppëflo's servers never see them."],
      ["Your output text from runs", "Streamed in your browser; we only see length and your thumbs rating."],
      ["Your identity", "The 'user id' is a random 24-char hex stored in your own localStorage. We don't see your name, email, IP, or anything else."],
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
            Where the data lives
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-dim)]">
            Tier 1 events are retained by Vercel Analytics for the standard
            Vercel window. Tier 2 telemetry is stored in Vercel KV (Redis),
            keyed by date, with a 90-day TTL. We do not sell or share either
            tier with third parties.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-[18px] font-semibold tracking-tight">Contact</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-dim)]">
            Questions, deletion requests, or concerns:{" "}
            <a
              href="mailto:justin@attiteud.com"
              className="font-medium text-[var(--ink)] underline"
            >
              justin@attiteud.com
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}