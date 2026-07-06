"use client";

import { useState, useSyncExternalStore } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useUIStore } from "@/lib/store/uiStore";
import {
  aiConfigServerSnapshot,
  aiConfigSnapshot,
  getProviderKey,
  setAIConfig,
  setProviderKey,
  subscribeAIConfig,
} from "@/lib/aiConfig";
import { testAIKey } from "@/lib/run";
import {
  MODELS,
  PROVIDER_HINTS,
  PROVIDER_LABELS,
  type ProviderId,
} from "@/lib/ai/models";

const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "gemini", "minimax", "kimi"];

export function ConnectAIDialog() {
  const open = useUIStore((s) => s.connectAIOpen);
  const config = useSyncExternalStore(
    subscribeAIConfig,
    aiConfigSnapshot,
    aiConfigServerSnapshot,
  );
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [testing, setTesting] = useState(false);

  const close = () => useUIStore.getState().setConnectAIOpen(false);

  const save = async (provider: ProviderId) => {
    const draft = (drafts[provider] ?? "").trim();
    if (!draft) return;
    setProviderKey(provider, draft);
    setDrafts((d) => ({ ...d, [provider]: "" }));
    setTesting(true);
    const result = await testAIKey();
    setTesting(false);
    if (result.ok) {
      toast({
        message: `Connected to ${PROVIDER_LABELS[provider]}.`,
        variant: "success",
      });
    } else {
      toast({
        message: `Saved, but the test call failed: ${result.error}`,
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
      className="w-[520px] max-w-[calc(100vw-32px)]"
    >
      <div className="p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">
          Connect AI providers
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
          Keys are stored in this browser only and sent to the provider that
          owns each one. Struppëflo&apos;s servers never see them. The security
          policy blocks every other outbound call.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {PROVIDER_ORDER.map((p) => (
            <ProviderRow
              key={p}
              provider={p}
              hasKey={!!getProviderKey(p)}
              draft={drafts[p] ?? ""}
              onDraftChange={(v) =>
                setDrafts((d) => ({ ...d, [p]: v }))
              }
              onSave={() => void save(p)}
              onDisconnect={() => {
                setProviderKey(p, null);
                toast({
                  message: `${PROVIDER_LABELS[p]} disconnected.`,
                  variant: "info",
                });
              }}
              testing={testing}
            />
          ))}
        </div>

        <div className="mt-5">
          <div className="text-[11px] font-semibold tracking-wide text-[var(--ink-faint)]">
            MODEL
          </div>
          <div className="mt-1.5 flex flex-col gap-1">
            {MODELS.map((m) => (
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
                <span className="text-[10.5px] uppercase tracking-wider text-[var(--ink-faint)] font-semibold">
                  {PROVIDER_LABELS[m.provider]}
                </span>
                <span className="ml-auto text-[11.5px] text-[var(--ink-faint)] text-right">
                  {m.blurb}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-[var(--ink-faint)]">
            Pick a model, then connect the matching provider&apos;s key above.
            Without a key for the chosen model, Organize / Suggest links /
            Sparks fall back to local heuristics.
          </p>
        </div>
      </div>
    </Dialog>
  );
}

function ProviderRow({
  provider,
  hasKey,
  draft,
  onDraftChange,
  onSave,
  onDisconnect,
  testing,
}: {
  provider: ProviderId;
  hasKey: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onSave: () => void;
  onDisconnect: () => void;
  testing: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--glass)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`w-2 h-2 rounded-full shrink-0 ${hasKey ? "bg-[#22c55e]" : "bg-[var(--ink-faint)]"}`}
        />
        <span className="text-[13px] font-semibold tracking-tight">
          {PROVIDER_LABELS[provider]}
        </span>
        {hasKey ? (
          <>
            <span className="text-[11.5px] text-[var(--ink-faint)] font-mono">
              {getProviderKey(provider)?.slice(0, 6)}…
            </span>
            <button
              type="button"
              onClick={onDisconnect}
              className="ml-auto text-[12px] font-medium text-[var(--danger)]
                hover:underline"
            >
              Disconnect
            </button>
          </>
        ) : (
          <span className="text-[11.5px] text-[var(--ink-faint)]">
            Not connected
          </span>
        )}
      </div>
      {!hasKey && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="password"
            value={draft}
            placeholder={PROVIDER_HINTS[provider]}
            autoComplete="off"
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") onSave();
            }}
            className="flex-1 h-9 rounded-lg bg-[var(--bg)] border
              border-[var(--glass-border)] px-2.5 text-[12.5px] font-mono
              outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            disabled={!draft.trim() || testing}
            onClick={onSave}
            className="btn-primary h-9 px-3 rounded-lg text-[12.5px]
              font-semibold disabled:opacity-45"
          >
            {testing ? "Testing…" : "Connect"}
          </button>
        </div>
      )}
    </div>
  );
}