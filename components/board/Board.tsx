"use client";

import { useCallback, useState } from "react";
import { useStore } from "zustand";
import { CanvasProvider, type WorkspaceStore } from "./CanvasProvider";
import { BoardCanvas } from "./BoardCanvas";
import { LinkPopover } from "./LinkPopover";
import { useUIStore } from "@/lib/store/uiStore";
import type { Camera, ID, InteractionPolicy } from "@/lib/types";

/**
 * Composition root for one canvas. The studio passes the persisted store with
 * history controls; the landing demo passes a throwaway store + DEMO policy.
 * The same component powers both — that is the point.
 */
export function Board({
  store,
  policy,
  history,
  initialCamera,
  className = "absolute inset-0",
}: {
  store: WorkspaceStore;
  policy: InteractionPolicy;
  history?: { pause: () => void; resume: () => void };
  initialCamera?: Camera;
  className?: string;
}) {
  const boardId = useStore(store, (s) => s.activeBoardId);
  const [popover, setPopover] = useState<{
    linkId: ID;
    x: number;
    y: number;
    normal?: { x: number; y: number };
  } | null>(null);

  const requestLinkPopover = useCallback(
    (linkId: ID, screen: { x: number; y: number; normal?: { x: number; y: number } }) => {
      setPopover({ linkId, x: screen.x, y: screen.y, normal: screen.normal });
    },
    [],
  );

  // Restore the saved camera per board (initial value only — the camera ref
  // is the live source of truth afterwards).
  const camera: Camera = initialCamera ??
    useUIStore.getState().savedCameras[boardId] ?? { tx: 0, ty: 0, s: 1 };

  return (
    <CanvasProvider
      key={boardId}
      store={store}
      boardId={boardId}
      policy={policy}
      history={history}
      initialCamera={camera}
      requestLinkPopover={requestLinkPopover}
    >
      <BoardCanvas className={className} />
      {popover && (
        <LinkPopover
          linkId={popover.linkId}
          screen={{ x: popover.x, y: popover.y, normal: popover.normal }}
          onClose={() => setPopover(null)}
        />
      )}
    </CanvasProvider>
  );
}
