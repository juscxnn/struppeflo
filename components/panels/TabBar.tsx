"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useBoardStore } from "@/lib/store/boardStore";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { MAX_NAME } from "@/lib/constants";
import type { ID } from "@/lib/types";

export function TabBar() {
  const boardOrder = useBoardStore(useShallow((s) => s.boardOrder));
  const activeBoardId = useBoardStore((s) => s.activeBoardId);
  const [renaming, setRenaming] = useState<ID | null>(null);

  return (
    <div className="flex items-center gap-1 min-w-0 overflow-x-auto thin-scroll">
      {boardOrder.map((id) => (
        <Tab
          key={id}
          boardId={id}
          active={id === activeBoardId}
          closable={boardOrder.length > 1}
          renaming={renaming === id}
          onRename={() => setRenaming(id)}
          onRenameDone={() => setRenaming(null)}
        />
      ))}
      <button
        type="button"
        aria-label="New board"
        title="New board"
        onClick={() => useBoardStore.getState().createBoard()}
        className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full
          text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--accent-soft)]"
      >
        <PlusIcon size={14} />
      </button>
    </div>
  );
}

function Tab({
  boardId,
  active,
  closable,
  renaming,
  onRename,
  onRenameDone,
}: {
  boardId: ID;
  active: boolean;
  closable: boolean;
  renaming: boolean;
  onRename: () => void;
  onRenameDone: () => void;
}) {
  const name = useBoardStore((s) => s.boards[boardId]?.name ?? "");

  if (renaming) {
    return (
      <input
        autoFocus
        defaultValue={name}
        maxLength={MAX_NAME}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          e.stopPropagation();
        }}
        onBlur={(e) => {
          useBoardStore.getState().renameBoard(boardId, e.target.value.trim());
          onRenameDone();
        }}
        className="shrink-0 h-8 px-3 rounded-full text-[13px] font-medium w-36
          bg-[var(--accent-soft)] outline-none"
      />
    );
  }

  return (
    <div
      className={`shrink-0 group flex items-center h-8 rounded-full text-[13px]
        font-medium transition-colors cursor-default
        ${active ? "bg-[var(--accent-soft)] text-[var(--ink)]" : "text-[var(--ink-dim)] hover:bg-[var(--accent-soft)]"}`}
    >
      <button
        type="button"
        onClick={() => useBoardStore.getState().setActiveBoard(boardId)}
        onDoubleClick={onRename}
        className={`h-full pl-3 ${closable ? "pr-1" : "pr-3"} max-w-44 truncate`}
        title={name}
      >
        {name}
      </button>
      {closable && (
        <button
          type="button"
          aria-label={`Close ${name}`}
          onClick={() => useBoardStore.getState().closeBoard(boardId)}
          className="w-5 h-5 mr-1.5 inline-flex items-center justify-center rounded-full
            opacity-0 group-hover:opacity-100 text-[var(--ink-faint)]
            hover:text-[var(--ink)] hover:bg-[var(--glass)] transition-opacity"
        >
          <CloseIcon size={10} />
        </button>
      )}
    </div>
  );
}
