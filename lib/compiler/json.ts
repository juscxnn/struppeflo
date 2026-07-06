import type { Board, CompiledBoard, CompiledCard } from "../types";
import type { OrderResult } from "./order";

export function emitJson(board: Board, order: OrderResult): CompiledBoard {
  const toCompiledCard = (cardId: string): CompiledCard => {
    const card = board.cards[cardId];
    const e = order.edges[cardId] ?? { dependsOn: [], inputs: [], relatedTo: [] };
    return {
      id: card.id,
      type: card.type,
      title: card.title,
      body: card.body,
      dependsOn: [...e.dependsOn],
      inputs: [...e.inputs],
      relatedTo: [...e.relatedTo],
    };
  };

  return {
    version: 1,
    board: {
      name: board.name,
      cardCount: Object.keys(board.cards).length,
      sectionCount: order.sections.length,
      linkCount: Object.keys(board.links).length,
    },
    sections: order.sections.map((section, i) => ({
      name: section.name,
      order: i,
      cards: section.cards.map((c) => toCompiledCard(c.id)),
    })),
    executionOrder: order.executionOrder.map((entry) => ({
      cardId: entry.card.id,
      title: entry.card.title,
      section: entry.sectionName,
    })),
    warnings: order.warnings.map((w) => ({ ...w })),
  };
}
