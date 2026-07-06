"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvas } from "./CanvasProvider";
import { useUIStore } from "@/lib/store/uiStore";
import { MAX_BODY, MAX_TITLE } from "@/lib/constants";
import type { Card } from "@/lib/types";

/**
 * Inline title/body editor. Edits are local state and committed to the store
 * ONCE on exit — one store write, one undo entry, no per-keystroke history.
 */
export function CardEditor({ card }: { card: Card }) {
  const ctx = useCanvas();
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const latest = useRef({ title, body });
  latest.current = { title, body };

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  useEffect(() => {
    const commit = () => {
      const { title: t, body: b } = latest.current;
      if (t !== card.title || b !== card.body) {
        ctx.store.getState().updateCard(ctx.boardId, card.id, {
          title: t,
          body: b,
        });
      }
    };
    // Commit on unmount — exit happens via setEditingCard(null) from any path.
    return commit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exit = () => useUIStore.getState().setEditingCard(null);

  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <div
      className="flex flex-col gap-1"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          exit();
        }
        e.stopPropagation();
      }}
    >
      <input
        ref={titleRef}
        value={title}
        maxLength={MAX_TITLE}
        placeholder="Title"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            bodyRef.current?.focus();
          }
        }}
        className="w-full bg-transparent outline-none text-[13px] font-semibold
          leading-snug placeholder:text-[var(--ink-faint)]"
      />
      <textarea
        ref={bodyRef}
        value={body}
        maxLength={MAX_BODY}
        placeholder="Write something…"
        rows={2}
        onChange={(e) => {
          setBody(e.target.value);
          autosize(e.target);
        }}
        onFocus={(e) => autosize(e.target)}
        className="w-full bg-transparent outline-none resize-none text-[12.5px]
          leading-relaxed text-[var(--ink-dim)] placeholder:text-[var(--ink-faint)]"
      />
      <div className="text-[10.5px] text-[var(--ink-faint)] select-none">
        esc to close
      </div>
    </div>
  );
}
