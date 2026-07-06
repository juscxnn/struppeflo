"use client";

import { useState, useSyncExternalStore } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useUIStore } from "@/lib/store/uiStore";
import {
  AI_MODELS,
  aiConfigServerSnapshot,
  aiConfigSnapshot,
  setAIConfig,
  subscribeAIConfig,
} from "@/lib/aiConfig";
import { testAIKey } from "@/lib/run";

export function ConnectAIDialog() {
  const open = useUIStore((s) => s.connectAIOpen);
  const config = useSyncExternalStore(
    subscribeAIConfig,
    aiConfigSnapshot,
    aiConfigServerSnapshot,
  );
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [testing, setTesting] = useState(false);

  const close = () => useUIStore.getState().setConnectAIOpen(false);

  const save = async () => {
    const key = draft.trim();
    if (!key) return;
    setAIConfig({ apiKey: key });
    setDraft("");
    setTesting(true);
    const result = await testAIKey();
    setTesting(false);
    if (result.ok) {
      toast({
        message:
          "Connected. Organize, Suggest links, Sparks and Run now use real AI.",
        variant: "success",
      });
      close();
    } else {
      toast({
        message: `Key saved, but the test call failed: ${result.error}`,
        variant: "warn",
        sticky: true,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      ariaLabel="Connect AI"
      className="w-[480px] max-w-[calc(100vw-32px)]"
    >
      <div className="p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">
          Connect Anthropic
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
          Your key is stored in this browser only and sent to exactly one
          place: <span className="font-mono text-[11.5px]">api.anthropic.com</span>{" "}
          (the security policy blocks everything else). Get a key at
          console.anthropic.com.
        </p>

        {config.apiKey ? (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg border
              border-[var(--border)] bg-[var(--glass)] px-3 py-2.5"
          >
            <span
              aria-hidden
              className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0"
            />
            <span className="text-[13px] font-medium">
              Connected · {config.apiKey.slice(0, 12)}…
            </span>
            <button
              type="button"
              onClick={() => {
                setAIConfig({ apiKey: null });
                toast({
                  message: "Disconnected — back to local heuristics.",
                  variant: "info",
                });
              }}
              className="ml-auto text-[12px] font-medium text-[var(--danger)]
                hover:underline"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <input
              type="password"
              value={draft}
              placeholder="sk-ant-…"
              autoComplete="off"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") void save();
              }}
              className="w-full h-10 rounded-lg bg-[var(--glass)] border
                border-[var(--glass-border)] px-3 text-[13px] font-mono
                outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}

        <div className="mt-4">
          <div className="text-[11px] font-semibold tracking-wide text-[var(--ink-faint)]">
            MODEL
          </div>
          <div className="mt-1.5 flex flex-col gap-1">
            {AI_MODELS.map((m) => (
              <label
                key={m.id}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2
                  cursor-pointer transition-colors
                  ${config.model === m.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"}`}
              >
                <input
                  type="radio"
                  name="ai-model"
                  checked={config.model === m.id}
                  onChange={() => setAIConfig({ model: m.id })}
                  className="accent-[var(--accent)]"
                />
                <span className="text-[13px] font-medium">{m.label}</span>
                <span className="ml-auto text-[11.5px] text-[var(--ink-faint)]">
                  {m.blurb}
                </span>
              </label>
            ))}
          </div>
        </div>

        {!config.apiKey && (
          <button
            type="button"
            disabled={!draft.trim() || testing}
            onClick={() => void save()}
            className="btn-primary mt-4 h-10 w-full rounded-lg text-[13.5px]
              font-semibold disabled:opacity-45"
          >
            {testing ? "Testing the key…" : "Connect"}
          </button>
        )}
      </div>
    </Dialog>
  );
}
