import type { Board, CompileResult } from "../types";
import { emitJson } from "./json";
import { emitMarkdown } from "./markdown";
import { orderBoard } from "./order";

export function compileBoard(board: Board): CompileResult {
  const order = orderBoard(board);
  return {
    markdown: emitMarkdown(board, order),
    json: emitJson(board, order),
    warnings: order.warnings,
  };
}

export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}
