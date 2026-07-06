"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useCanvas } from "./CanvasProvider";
import { useCardDrag } from "./hooks/useCardDrag";
import { useLinkDraw } from "./hooks/useLinkDraw";
import { CardEditor } from "./CardEditor";
import { useUIStore } from "@/lib/store/uiStore";
import { Popover, type AnchorRect } from "@/components/ui/Popover";
import {
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { CARD_COLOR_TINT, CARD_TYPE_META } from "@/lib/constants";
import {
  CARD_COLORS,
  CARD_TYPES,
  type CardColor,
  type CardType,
  type ID,
} from "@/lib/types";

export const CardView = memo(function CardView({ cardId }: { cardId: ID }) {
  const ctx = useCanvas();
  const card = useStore(ctx.store, (s) => s.boards[ctx.boardId]?.cards[cardId]);
  const selected = useUIStore((s) => s.selection.includes(cardId));
  const editing = useUIStore((s) => s.editingCardId === cardId);
  const drag = useCardDrag(cardId);
  const linkDraw = useLinkDraw(cardId);
  const elRef = useRef<HTMLDivElement | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<AnchorRect | null>(null);

  // Register the DOM node for imperative access (drag, glow, coach marks).
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    ctx.cardElements.set(cardId, el);
    return () => {
      ctx.cardElements.delete(cardId);
    };
  }, [cardId, ctx]);

  // Measured-height write-back: offsetHeight is layout px (world units,
  // unaffected by the canvas scale transform). Paused out of undo history.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 0) {
        ctx.history.pause();
        ctx.store.getState().setCardHeight(ctx.boardId, cardId, h);
        ctx.history.resume();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardId, ctx]);

  if (!card) return null;

  const meta = CARD_TYPE_META[card.type];
  const tint = CARD_COLOR_TINT[card.color];
  const showToolbar = ctx.policy.edit && !editing;

  return (
    <div
      ref={elRef}
      {...drag}
      data-selected={selected || undefined}
      className="board-card glass-card group absolute rounded-xl cursor-grab
        select-none"
      style={{
        left: card.x,
        top: card.y,
        width: card.w,
        zIndex: card.z,
        outline: selected ? "2px solid var(--accent)" : undefined,
        outlineOffset: 1,
      }}
    >
      {tint !== "transparent" && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: tint }}
        />
      )}

      <div className="relative p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            aria-hidden
            className="w-[7px] h-[7px] rounded-full shrink-0"
            style={{ background: meta.dot }}
          />
          <span className="text-[10.5px] uppercase tracking-[0.06em] font-medium text-[var(--ink-faint)]">
            {meta.label}
          </span>

          {showToolbar && (
            <span
              className="ml-auto flex items-center gap-0.5 opacity-0
                group-hover:opacity-100 transition-opacity"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Edit card"
                onClick={() => useUIStore.getState().setEditingCard(cardId)}
                className="w-6 h-6 inline-flex items-center justify-center rounded-md
                  text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--accent-soft)]"
              >
                <PencilIcon size={12.5} />
              </button>
              <button
                type="button"
                aria-label="Card type and color"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setMenuAnchor({ x: r.x, y: r.y, w: r.width, h: r.height });
                }}
                className="w-6 h-6 inline-flex items-center justify-center rounded-md
                  text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--accent-soft)]"
              >
                <ChevronDownIcon size={13} />
              </button>
              {ctx.policy.delete && (
                <button
                  type="button"
                  aria-label="Delete card"
                  onClick={() =>
                    ctx.store.getState().deleteCards(ctx.boardId, [cardId])
                  }
                  className="w-6 h-6 inline-flex items-center justify-center rounded-md
                    text-[var(--ink-faint)] hover:text-[var(--danger)]
                    hover:bg-[rgba(229,72,77,0.1)]"
                >
                  <TrashIcon size={12.5} />
                </button>
              )}
            </span>
          )}
        </div>

        {editing ? (
          <CardEditor card={card} />
        ) : (
          <>
            {card.title && (
              <div className="text-[13px] font-semibold leading-snug break-words">
                {card.title}
              </div>
            )}
            {card.body && (
              <div
                className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--ink-dim)]
                  whitespace-pre-wrap break-words line-clamp-6"
              >
                {card.body}
              </div>
            )}
            {!card.title && !card.body && (
              <div className="text-[12.5px] text-[var(--ink-faint)] italic">
                Empty card — click to write
              </div>
            )}
          </>
        )}
      </div>

      {/* Edge handle: drag from here to another card to draw a link. */}
      {ctx.policy.createLinks && !editing && (
        <button
          type="button"
          aria-label="Drag to link this card to another"
          title="Drag to another card to link"
          {...linkDraw}
          className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-5 h-5
            rounded-full border-2 border-[var(--accent)] bg-[var(--surface)]
            opacity-50 group-hover:opacity-100 transition-opacity
            cursor-crosshair z-10 flex items-center justify-center
            text-[var(--accent)] text-[10px] leading-none font-bold"
        >
          +
        </button>
      )}

      {menuAnchor && (
        <CardMenu
          cardId={cardId}
          type={card.type}
          color={card.color}
          anchor={menuAnchor}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </div>
  );
});

function CardMenu({
  cardId,
  type,
  color,
  anchor,
  onClose,
}: {
  cardId: ID;
  type: CardType;
  color: CardColor;
  anchor: AnchorRect;
  onClose: () => void;
}) {
  const ctx = useCanvas();
  const update = (patch: { type?: CardType; color?: CardColor }) =>
    ctx.store.getState().updateCard(ctx.boardId, cardId, patch);

  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="p-2 w-44" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex flex-col">
          {CARD_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                update({ type: t });
                onClose();
              }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px]
                hover:bg-[var(--accent-soft)] ${t === type ? "font-semibold" : ""}`}
            >
              <span
                className="w-[7px] h-[7px] rounded-full"
                style={{ background: CARD_TYPE_META[t].dot }}
              />
              {CARD_TYPE_META[t].label}
              {t === type && <span className="ml-auto text-[var(--accent)]">✓</span>}
            </button>
          ))}
        </div>
        <div className="h-px my-1.5 bg-[var(--glass-border)]" />
        <div className="flex items-center justify-between px-1.5 py-1">
          {CARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => update({ color: c })}
              className="w-5 h-5 rounded-full border transition-transform hover:scale-110"
              style={{
                background:
                  c === "default" ? "var(--glass)" : CARD_COLOR_TINT[c],
                borderColor:
                  c === color ? "var(--accent)" : "var(--glass-border)",
                borderWidth: c === color ? 2 : 1,
              }}
            />
          ))}
        </div>
      </div>
    </Popover>
  );
}
