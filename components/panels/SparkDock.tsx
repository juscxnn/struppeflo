"use client";

import { useEffect, useRef, useState } from "react";
import { useBoardStore } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";
import { fetchSparks } from "@/lib/aiActions";
import { getCanvas } from "@/lib/canvasBridge";
import { CARD_W } from "@/lib/constants";
import { ChevronDownIcon, SparklesIcon } from "@/components/ui/icons";
import type { SparkQuestion } from "@/lib/types";

/**
 * Spark questions — the generated questionnaire that fights blank-canvas
 * paralysis. Answering one turns it into a real card (title = the question,
 * body = your answer) so the thinking lands on the board.
 */
export function SparkDock() {
  const boardId = useBoardStore((s) => s.activeBoardId);
  const cardCount = useBoardStore(
    (s) => Object.keys(s.boards[s.activeBoardId]?.cards ?? {}).length,
  );
  const persona = useUIStore((s) => s.onboarding.persona);
  const [sparks, setSparks] = useState<SparkQuestion[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [answering, setAnswering] = useState<string | null>(null);
  const consumed = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const qs = await fetchSparks(persona);
      if (!cancelled) {
        setSparks(qs.filter((q) => !consumed.current.has(q.id)));
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [boardId, cardCount, persona]);

  if (sparks.length === 0) return null;

  const answer = (spark: SparkQuestion, text: string) => {
    consumed.current.add(spark.id);
    setSparks((s) => s.filter((q) => q.id !== spark.id));
    setAnswering(null);
    if (!text.trim()) return;

    const state = useBoardStore.getState();
    const board = state.boards[state.activeBoardId];
    let x: number;
    let y: number;
    const division = spark.divisionId
      ? board?.divisions[spark.divisionId]
      : undefined;
    if (division) {
      x = division.x + division.w + 32;
      y = division.y + 16;
    } else {
      const center = getCanvas()?.viewportCenterWorld() ?? { x: 0, y: 0 };
      x = Math.round(center.x - CARD_W / 2);
      y = Math.round(center.y - 40);
    }
    state.addCard(state.activeBoardId, {
      type: spark.answerType,
      title: spark.question,
      body: text.trim(),
      x,
      y,
    });
  };

  return (
    <div className="absolute bottom-5 left-5 z-40 w-[300px] flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="self-start glass-strong glass-blur rounded-full h-9 pl-3 pr-2.5
          inline-flex items-center gap-1.5 text-[12.5px] font-semibold
          text-[var(--accent)]"
      >
        <SparklesIcon size={14} />
        Sparks
        <ChevronDownIcon
          size={13}
          className={`transition-transform ${collapsed ? "" : "rotate-180"}`}
        />
      </button>

      {!collapsed &&
        sparks.map((spark) => (
          <div
            key={spark.id}
            className="glass-card rounded-2xl p-3 fade-up"
          >
            <div className="text-[12.5px] font-medium leading-snug">
              {spark.question}
            </div>
            {answering === spark.id ? (
              <SparkAnswer
                onSubmit={(text) => answer(spark, text)}
                onCancel={() => setAnswering(null)}
              />
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAnswering(spark.id)}
                  className="h-7 px-3 rounded-full text-[12px] font-semibold
                    text-[var(--accent)] bg-[var(--accent-soft)]
                    hover:brightness-110"
                >
                  Answer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    consumed.current.add(spark.id);
                    setSparks((s) => s.filter((q) => q.id !== spark.id));
                  }}
                  className="h-7 px-2.5 rounded-full text-[12px] font-medium
                    text-[var(--ink-faint)] hover:text-[var(--ink)]"
                >
                  Skip
                </button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

function SparkAnswer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="mt-2">
      <textarea
        autoFocus
        value={text}
        rows={2}
        placeholder="Type your answer — it becomes a card"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(text);
          if (e.key === "Escape") onCancel();
        }}
        className="w-full rounded-xl bg-[var(--glass)] border border-[var(--glass-border)]
          px-2.5 py-2 text-[12.5px] outline-none resize-none
          placeholder:text-[var(--ink-faint)]"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSubmit(text)}
          className="h-7 px-3 rounded-full text-[12px] font-semibold text-white
            bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]"
        >
          Add card
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-2.5 rounded-full text-[12px] font-medium
            text-[var(--ink-faint)] hover:text-[var(--ink)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
