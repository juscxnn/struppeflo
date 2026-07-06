import {
  CardStackIcon,
  DumpIcon,
  FrameIcon,
  LinkIcon,
  QuestionIcon,
  XRayIcon,
} from "@/components/ui/icons";

const FEATURES = [
  {
    icon: LinkIcon,
    title: "Proximity linking",
    text: "Drag a card near another until it glows — release to link. Retype it to depends-on or input-to in one click. Relationships without menus.",
  },
  {
    icon: FrameIcon,
    title: "Zones",
    text: "Draw named regions and drop cards in. Zones move with their cards, and each one becomes a section in the compiled prompt.",
  },
  {
    icon: XRayIcon,
    title: "Prompt X-Ray",
    text: "A live panel showing the board compiled to Markdown or JSON, with a token estimate and dependency-cycle warnings. Copy, paste, run.",
  },
  {
    icon: DumpIcon,
    title: "Brain dump + AI Organize",
    text: "Paste twenty half-thoughts; each line becomes a typed card. One click clusters them into named zones — deterministic, instant, undoable.",
  },
  {
    icon: QuestionIcon,
    title: "Spark questions",
    text: "The board notices what's missing — no audience defined, a task with no prerequisites — and asks. Answers land as cards.",
  },
  {
    icon: CardStackIcon,
    title: "Tabs & templates",
    text: "Boards as tabs: GTM plan, research project, product spec. Generate a workflow view of any board into a fresh tab without touching the original.",
  },
];

export function FeatureGrid() {
  return (
    <section className="px-6 py-20 max-w-5xl mx-auto">
      <h2 className="text-[clamp(26px,4vw,36px)] font-bold tracking-tight text-center">
        Small surface. Deep structure.
      </h2>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass-card rounded-3xl p-5">
            <span
              className="w-9 h-9 rounded-xl inline-flex items-center justify-center
                text-[var(--accent)] bg-[var(--accent-soft)]"
            >
              <f.icon size={17} />
            </span>
            <h3 className="mt-3 text-[15px] font-semibold tracking-tight">
              {f.title}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
              {f.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
