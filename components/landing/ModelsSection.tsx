const MODELS: Array<[string, string, string]> = [
  ["Anthropic", "Claude Opus 4.8 · Sonnet 5 · Haiku 4.5", "Long-horizon agentic work, nuanced reasoning"],
  ["OpenAI", "GPT-5 · GPT-5 mini · GPT-4.1", "General planning, code, broad knowledge"],
  ["Google", "Gemini 2.5 Pro · 2.5 Flash", "Multimodal, large context, fast"],
  ["MiniMax", "MiniMax-Text-01 · MiniMax-VL-01", "Long-context reasoning, Chinese + English"],
  ["Moonshot", "Kimi K2 · Moonshot v1", "Long documents, bilingual"],
];

export function ModelsSection() {
  return (
    <section id="models" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        MODELS
      </div>
      <h2 className="mt-2 text-[clamp(22px,3.5vw,30px)] font-semibold tracking-tight max-w-xl">
        One board. Five models. Your key.
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-dim)] max-w-2xl">
        Tailored system prompt per provider, so the compiled board renders in
        its native format. Bring your own key. Browser to API direct, no
        proxy.
      </p>

      <div className="mt-8 glass rounded-xl overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_1fr] text-[13px]">
          <div className="px-4 py-3 text-[11px] font-semibold tracking-[0.1em] text-[var(--ink-faint)] border-b border-[var(--border)]">
            PROVIDER
          </div>
          <div className="px-4 py-3 text-[11px] font-semibold tracking-[0.1em] text-[var(--ink-faint)] border-b border-[var(--border)]">
            MODELS
          </div>
          <div className="px-4 py-3 text-[11px] font-semibold tracking-[0.1em] text-[var(--ink-faint)] border-b border-[var(--border)]">
            STRONG AT
          </div>
          {MODELS.map(([provider, models, strong], i) => (
            <div key={provider} className="contents">
              <div
                className={`px-4 py-3 font-medium ${
                  i < MODELS.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                {provider}
              </div>
              <div
                className={`px-4 py-3 text-[var(--ink-dim)] ${
                  i < MODELS.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                {models}
              </div>
              <div
                className={`px-4 py-3 text-[var(--ink-dim)] ${
                  i < MODELS.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                {strong}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}