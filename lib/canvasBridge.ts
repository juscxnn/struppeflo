/**
 * Bridge between the studio chrome (toolbar, command palette, shortcuts —
 * rendered outside the CanvasProvider) and the active canvas. Only the
 * studio's full-policy canvas registers itself; the landing demo never does.
 */

export interface CanvasApi {
  /** World coordinates of the current viewport center. */
  viewportCenterWorld: () => { x: number; y: number };
  /** Toggle a helper class on the world element (FLIP transitions). */
  setWorldClass: (className: string, on: boolean) => void;
  /** Frame all content in the viewport. */
  zoomFit: () => void;
}

let current: CanvasApi | null = null;

export function registerCanvas(api: CanvasApi): () => void {
  current = api;
  return () => {
    if (current === api) current = null;
  };
}

export function getCanvas(): CanvasApi | null {
  return current;
}
