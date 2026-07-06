import { create, type StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { temporal } from "zundo";
import { guardedStorage } from "./storage";
import {
  MAX_BODY,
  MAX_BOARDS,
  MAX_CARDS_PER_BOARD,
  MAX_DIVISIONS_PER_BOARD,
  MAX_LINKS_PER_BOARD,
  MAX_NAME,
  MAX_TITLE,
  CARD_DEFAULT_H,
  CARD_W,
  DIVISION_MIN_H,
  DIVISION_MIN_W,
  STORAGE_KEY_WORKSPACE,
  UNDO_LIMIT,
} from "../constants";
import { pointInRect } from "../geometry";
import { emit } from "../events";
import { fitDivision } from "../snap";
import { ZONE_FIT_PADDING } from "../constants";
import type {
  Board,
  Card,
  CardType,
  Division,
  ID,
  Link,
  LinkType,
  OrganizePlan,
  Rect,
  Workspace,
} from "../types";

export interface WorkspaceState extends Workspace {
  /* boards (tabs) */
  createBoard: (name?: string) => ID;
  insertBoard: (board: Board) => void;
  renameBoard: (id: ID, name: string) => void;
  closeBoard: (id: ID) => void;
  setActiveBoard: (id: ID) => void;
  /* cards */
  addCard: (
    boardId: ID,
    partial?: Partial<
      Pick<Card, "type" | "title" | "body" | "x" | "y" | "color" | "divisionId">
    >,
  ) => ID | null;
  updateCard: (boardId: ID, cardId: ID, patch: Partial<Card>) => void;
  setCardHeight: (boardId: ID, cardId: ID, h: number) => void;
  deleteCards: (boardId: ID, ids: ID[]) => void;
  /** Atomic drag-drop commit: positions + membership + z-bump. */
  commitMove: (boardId: ID, moves: Array<{ id: ID; x: number; y: number }>) => void;
  /* divisions */
  addDivision: (boardId: ID, rect: Rect, name?: string) => ID | null;
  updateDivision: (boardId: ID, id: ID, patch: Partial<Division>) => void;
  /** Atomic division drag/resize commit; also moves member cards. */
  commitDivision: (
    boardId: ID,
    id: ID,
    rect: Rect,
    memberMoves: Array<{ id: ID; x: number; y: number }>,
  ) => void;
  deleteDivision: (boardId: ID, id: ID) => void;
  /* links */
  addLink: (boardId: ID, from: ID, to: ID, type: LinkType, auto: boolean) => ID | null;
  updateLink: (
    boardId: ID,
    id: ID,
    patch: Partial<Pick<Link, "type" | "from" | "to">>,
  ) => void;
  deleteLink: (boardId: ID, id: ID) => void;
  /* bulk */
  applyOrganize: (boardId: ID, plan: OrganizePlan) => void;
  importWorkspace: (ws: Workspace) => void;
  resetWorkspace: () => void;
}

export function newBoard(name: string): Board {
  return {
    id: crypto.randomUUID(),
    name: name.slice(0, MAX_NAME),
    cards: {},
    divisions: {},
    links: {},
    maxZ: 0,
    createdAt: Date.now(),
  };
}

export function defaultWorkspace(): Workspace {
  const board = newBoard("Board 1");
  return {
    version: 1,
    boards: { [board.id]: board },
    boardOrder: [board.id],
    activeBoardId: board.id,
  };
}

/** Smallest-area division whose rect contains the card center wins. */
export function divisionForCard(
  card: Pick<Card, "x" | "y" | "w" | "h">,
  divisions: Record<ID, Division>,
): ID | null {
  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2;
  let best: Division | null = null;
  for (const d of Object.values(divisions)) {
    if (pointInRect(cx, cy, d) && (!best || d.w * d.h < best.w * best.h)) {
      best = d;
    }
  }
  return best ? best.id : null;
}

function pairKey(a: ID, b: ID): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Shared state creator: the persisted studio store and the landing demo's
 * throwaway vanilla store are the same machine with different wrappers.
 */
export function createWorkspaceSlice(
  initial: Workspace,
): StateCreator<WorkspaceState> {
  return (set, get) => ({
    ...initial,

    /* ------------------------------ boards ------------------------------ */

    createBoard: (name) => {
      const state = get();
      if (state.boardOrder.length >= MAX_BOARDS) return state.activeBoardId;
      const board = newBoard(name ?? `Board ${state.boardOrder.length + 1}`);
      set((s) => ({
        boards: { ...s.boards, [board.id]: board },
        boardOrder: [...s.boardOrder, board.id],
        activeBoardId: board.id,
      }));
      emit("board:created", { boardId: board.id });
      return board.id;
    },

    insertBoard: (board) => {
      set((s) => {
        if (s.boardOrder.length >= MAX_BOARDS) return s;
        return {
          boards: { ...s.boards, [board.id]: board },
          boardOrder: [...s.boardOrder, board.id],
          activeBoardId: board.id,
        };
      });
    },

    renameBoard: (id, name) => {
      set((s) => {
        const board = s.boards[id];
        if (!board) return s;
        return {
          boards: {
            ...s.boards,
            [id]: { ...board, name: name.slice(0, MAX_NAME) || board.name },
          },
        };
      });
    },

    closeBoard: (id) => {
      set((s) => {
        if (s.boardOrder.length <= 1 || !s.boards[id]) return s;
        const boards = { ...s.boards };
        delete boards[id];
        const boardOrder = s.boardOrder.filter((b) => b !== id);
        const activeBoardId =
          s.activeBoardId === id
            ? boardOrder[Math.max(0, s.boardOrder.indexOf(id) - 1)]
            : s.activeBoardId;
        return { boards, boardOrder, activeBoardId };
      });
    },

    setActiveBoard: (id) => {
      set((s) => (s.boards[id] ? { activeBoardId: id } : s));
      emit("board:opened", { boardId: id });
    },

    /* ------------------------------- cards ------------------------------ */

    addCard: (boardId, partial = {}) => {
      const board = get().boards[boardId];
      if (!board || Object.keys(board.cards).length >= MAX_CARDS_PER_BOARD) {
        return null;
      }
      const now = Date.now();
      const card: Card = {
        id: crypto.randomUUID(),
        type: partial.type ?? "note",
        title: (partial.title ?? "").slice(0, MAX_TITLE),
        body: (partial.body ?? "").slice(0, MAX_BODY),
        x: partial.x ?? 0,
        y: partial.y ?? 0,
        w: CARD_W,
        h: CARD_DEFAULT_H,
        z: board.maxZ + 1,
        divisionId: partial.divisionId ?? null,
        color: partial.color ?? "default",
        createdAt: now,
        updatedAt: now,
      };
      card.divisionId = partial.divisionId ?? divisionForCard(card, board.divisions);
      set((s) => {
        const b = s.boards[boardId];
        if (!b) return s;
        return {
          boards: {
            ...s.boards,
            [boardId]: {
              ...b,
              cards: { ...b.cards, [card.id]: card },
              maxZ: card.z,
            },
          },
        };
      });
      emit("card:created", { boardId, cardId: card.id, cardType: card.type });
      return card.id;
    },

    updateCard: (boardId, cardId, patch) => {
      let nextType: string | null = null;
      set((s) => {
        const b = s.boards[boardId];
        const card = b?.cards[cardId];
        if (!b || !card) return s;
        const next: Card = {
          ...card,
          ...patch,
          title: (patch.title ?? card.title).slice(0, MAX_TITLE),
          body: (patch.body ?? card.body).slice(0, MAX_BODY),
          id: card.id,
          updatedAt: Date.now(),
        };
        nextType = next.type;
        return {
          boards: {
            ...s.boards,
            [boardId]: { ...b, cards: { ...b.cards, [cardId]: next } },
          },
        };
      });
      if (nextType !== null) {
        emit("card:updated", { boardId, cardId, cardType: nextType });
      }
    },

    setCardHeight: (boardId, cardId, h) => {
      set((s) => {
        const b = s.boards[boardId];
        const card = b?.cards[cardId];
        if (!b || !card || Math.abs(card.h - h) < 1) return s;
        return {
          boards: {
            ...s.boards,
            [boardId]: { ...b, cards: { ...b.cards, [cardId]: { ...card, h } } },
          },
        };
      });
    },

    deleteCards: (boardId, ids) => {
      if (ids.length === 0) return;
      set((s) => {
        const b = s.boards[boardId];
        if (!b) return s;
        const dead = new Set(ids);
        const cards = { ...b.cards };
        ids.forEach((id) => delete cards[id]);
        const links: Record<ID, Link> = {};
        for (const link of Object.values(b.links)) {
          if (!dead.has(link.from) && !dead.has(link.to)) links[link.id] = link;
        }
        return {
          boards: { ...s.boards, [boardId]: { ...b, cards, links } },
        };
      });
      ids.forEach((cardId) => emit("card:deleted", { boardId, cardId }));
    },

    commitMove: (boardId, moves) => {
      if (moves.length === 0) return;
      const affectedDivisions = new Set<ID>();
      set((s) => {
        const b = s.boards[boardId];
        if (!b) return s;
        const cards = { ...b.cards };
        const oldMembership = new Map<ID, ID | null>();
        for (const m of moves) {
          const card = cards[m.id];
          if (card) oldMembership.set(card.id, card.divisionId);
        }
        let z = b.maxZ;
        for (const m of moves) {
          const card = cards[m.id];
          if (!card) continue;
          z += 1;
          const newDivisionId = divisionForCard(
            { x: m.x, y: m.y, w: card.w, h: card.h },
            b.divisions,
          );
          cards[m.id] = {
            ...card,
            x: m.x,
            y: m.y,
            z,
            divisionId: newDivisionId,
            updatedAt: Date.now(),
          };
          const prev = oldMembership.get(card.id) ?? null;
          if (prev !== newDivisionId) {
            if (prev) affectedDivisions.add(prev);
            if (newDivisionId) affectedDivisions.add(newDivisionId);
          }
        }
        return {
          boards: { ...s.boards, [boardId]: { ...b, cards, maxZ: z } },
        };
      });

      // Auto-fit affected zones to their (now possibly different) membership.
      if (affectedDivisions.size > 0) {
        set((s) => {
          const b = s.boards[boardId];
          if (!b) return s;
          const divisions = { ...b.divisions };
          for (const divId of affectedDivisions) {
            const division = divisions[divId];
            if (!division) continue;
            const members = Object.values(b.cards).filter(
              (c) => c.divisionId === divId,
            );
            const fitted = fitDivision(
              division,
              members,
              ZONE_FIT_PADDING,
              DIVISION_MIN_W,
              DIVISION_MIN_H,
            );
            if (fitted) {
              divisions[divId] = { ...division, ...fitted };
            }
          }
          return { boards: { ...s.boards, [boardId]: { ...b, divisions } } };
        });
      }

      moves.forEach((m) => emit("card:moved", { boardId, cardId: m.id }));
    },

    /* ----------------------------- divisions ---------------------------- */

    addDivision: (boardId, rect, name) => {
      const board = get().boards[boardId];
      if (
        !board ||
        Object.keys(board.divisions).length >= MAX_DIVISIONS_PER_BOARD
      ) {
        return null;
      }
      const division: Division = {
        id: crypto.randomUUID(),
        name: (name ?? "Untitled zone").slice(0, MAX_NAME),
        x: rect.x,
        y: rect.y,
        w: Math.max(DIVISION_MIN_W, rect.w),
        h: Math.max(DIVISION_MIN_H, rect.h),
        color: "default",
        z: board.maxZ + 1,
        createdAt: Date.now(),
      };
      set((s) => {
        const b = s.boards[boardId];
        if (!b) return s;
        const divisions = { ...b.divisions, [division.id]: division };
        const cards = { ...b.cards };
        for (const card of Object.values(cards)) {
          const next = divisionForCard(card, divisions);
          if (next !== card.divisionId) {
            cards[card.id] = { ...card, divisionId: next };
          }
        }
        return {
          boards: {
            ...s.boards,
            [boardId]: { ...b, divisions, cards, maxZ: division.z },
          },
        };
      });
      // Auto-fit the freshly-created zone to any cards now inside it.
      const fitted = fitDivisionToMembers(get().boards[boardId], division.id);
      if (fitted) {
        set((s) => {
          const b = s.boards[boardId];
          if (!b) return s;
          const divisions = { ...b.divisions };
          divisions[division.id] = { ...divisions[division.id], ...fitted };
          return { boards: { ...s.boards, [boardId]: { ...b, divisions } } };
        });
      }
      emit("division:created", { boardId, divisionId: division.id });
      return division.id;
    },

    updateDivision: (boardId, id, patch) => {
      set((s) => {
        const b = s.boards[boardId];
        const division = b?.divisions[id];
        if (!b || !division) return s;
        const next: Division = {
          ...division,
          ...patch,
          name: (patch.name ?? division.name).slice(0, MAX_NAME),
          id: division.id,
        };
        return {
          boards: {
            ...s.boards,
            [boardId]: { ...b, divisions: { ...b.divisions, [id]: next } },
          },
        };
      });
    },

    commitDivision: (boardId, id, rect, memberMoves) => {
      set((s) => {
        const b = s.boards[boardId];
        const division = b?.divisions[id];
        if (!b || !division) return s;
        const divisions = {
          ...b.divisions,
          [id]: {
            ...division,
            x: rect.x,
            y: rect.y,
            w: Math.max(DIVISION_MIN_W, rect.w),
            h: Math.max(DIVISION_MIN_H, rect.h),
          },
        };
        const cards = { ...b.cards };
        for (const m of memberMoves) {
          const card = cards[m.id];
          if (card) cards[m.id] = { ...card, x: m.x, y: m.y };
        }
        for (const card of Object.values(cards)) {
          const next = divisionForCard(card, divisions);
          if (next !== card.divisionId) {
            cards[card.id] = { ...card, divisionId: next };
          }
        }
        return {
          boards: { ...s.boards, [boardId]: { ...b, divisions, cards } },
        };
      });
      emit("division:resized", { boardId, divisionId: id });
    },

    deleteDivision: (boardId, id) => {
      set((s) => {
        const b = s.boards[boardId];
        if (!b || !b.divisions[id]) return s;
        const divisions = { ...b.divisions };
        delete divisions[id];
        const cards = { ...b.cards };
        for (const card of Object.values(cards)) {
          const next = divisionForCard(card, divisions);
          if (next !== card.divisionId) {
            cards[card.id] = { ...card, divisionId: next };
          }
        }
        return {
          boards: { ...s.boards, [boardId]: { ...b, divisions, cards } },
        };
      });
      emit("division:deleted", { boardId, divisionId: id });
    },

    /* ------------------------------- links ------------------------------ */

    addLink: (boardId, from, to, type, auto) => {
      const board = get().boards[boardId];
      if (
        !board ||
        from === to ||
        !board.cards[from] ||
        !board.cards[to] ||
        Object.keys(board.links).length >= MAX_LINKS_PER_BOARD
      ) {
        return null;
      }
      const key = pairKey(from, to);
      for (const link of Object.values(board.links)) {
        if (pairKey(link.from, link.to) === key) return null;
      }
      const link: Link = {
        id: crypto.randomUUID(),
        from,
        to,
        type,
        auto,
        createdAt: Date.now(),
      };
      set((s) => {
        const b = s.boards[boardId];
        if (!b) return s;
        return {
          boards: {
            ...s.boards,
            [boardId]: { ...b, links: { ...b.links, [link.id]: link } },
          },
        };
      });
      emit("link:created", {
        boardId,
        linkId: link.id,
        linkType: link.type,
      });
      return link.id;
    },

    updateLink: (boardId, id, patch) => {
      let nextType: string | null = null;
      set((s) => {
        const b = s.boards[boardId];
        const link = b?.links[id];
        if (!b || !link) return s;
        const next = { ...link, ...patch, id: link.id };
        nextType = next.type;
        return {
          boards: {
            ...s.boards,
            [boardId]: {
              ...b,
              links: { ...b.links, [id]: next },
            },
          },
        };
      });
      if (nextType !== null) {
        emit("link:updated", { boardId, linkId: id, linkType: nextType });
      }
    },

    deleteLink: (boardId, id) => {
      set((s) => {
        const b = s.boards[boardId];
        if (!b || !b.links[id]) return s;
        const links = { ...b.links };
        delete links[id];
        return { boards: { ...s.boards, [boardId]: { ...b, links } } };
      });
      emit("link:deleted", { boardId, linkId: id });
    },

    /* -------------------------------- bulk ------------------------------- */

    applyOrganize: (boardId, plan) => {
      set((s) => {
        const b = s.boards[boardId];
        if (!b) return s;
        let z = b.maxZ;
        const created: Division[] = plan.divisions.map((d) => {
          z += 1;
          return {
            id: crypto.randomUUID(),
            name: d.name.slice(0, MAX_NAME),
            x: d.rect.x,
            y: d.rect.y,
            w: Math.max(DIVISION_MIN_W, d.rect.w),
            h: Math.max(DIVISION_MIN_H, d.rect.h),
            color: d.color,
            z,
            createdAt: Date.now(),
          };
        });
        const divisions = { ...b.divisions };
        created.forEach((d) => {
          divisions[d.id] = d;
        });
        const cards = { ...b.cards };
        for (const [cardId, divisionIdx] of Object.entries(plan.assignments)) {
          const card = cards[cardId];
          const division = created[divisionIdx];
          const pos = plan.positions[cardId];
          if (!card || !division || !pos) continue;
          cards[cardId] = {
            ...card,
            x: pos.x,
            y: pos.y,
            divisionId: division.id,
            updatedAt: Date.now(),
          };
        }
        return {
          boards: { ...s.boards, [boardId]: { ...b, divisions, cards, maxZ: z } },
        };
      });
    },

    importWorkspace: (ws) => {
      set(() => ws);
    },

    resetWorkspace: () => {
      set(() => defaultWorkspace());
      emit("board:reset");
    },
  });
}

export const useBoardStore = create<WorkspaceState>()(
  temporal(
    persist(createWorkspaceSlice(defaultWorkspace()), {
      name: STORAGE_KEY_WORKSPACE,
      storage: createJSONStorage(() => guardedStorage),
      partialize: (s) => ({
        version: s.version,
        boards: s.boards,
        boardOrder: s.boardOrder,
        activeBoardId: s.activeBoardId,
      }),
    }),
    {
    limit: UNDO_LIMIT,
    partialize: (s) => ({
      version: s.version,
      boards: s.boards,
      boardOrder: s.boardOrder,
      activeBoardId: s.activeBoardId,
    }),
  }),
);

/** History controls (undo/redo/pause) — only meaningful on the studio store. */
export const boardHistory = {
  undo: () => useBoardStore.temporal.getState().undo(),
  redo: () => useBoardStore.temporal.getState().redo(),
  pause: () => useBoardStore.temporal.getState().pause(),
  resume: () => useBoardStore.temporal.getState().resume(),
  clear: () => useBoardStore.temporal.getState().clear(),
};

function fitDivisionToMembers(
  board: Board | undefined,
  divisionId: ID,
): { x: number; y: number; w: number; h: number } | null {
  if (!board) return null;
  const division = board.divisions[divisionId];
  if (!division) return null;
  const members = Object.values(board.cards).filter(
    (c) => c.divisionId === divisionId,
  );
  return fitDivision(
    division,
    members,
    ZONE_FIT_PADDING,
    DIVISION_MIN_W,
    DIVISION_MIN_H,
  );
}
