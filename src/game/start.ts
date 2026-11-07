import type { SyncStatus } from "../sync/sync";
import type { Action } from "./input";

export type Rect = { x: number; y: number; w: number; h: number };

/** Start screen buttons, shared by the renderer and tap hit-testing. */
export function startLayout(w: number, h: number) {
  const bw = Math.min(320, w - 48);
  const x = (w - bw) / 2;
  const pickY = h * 0.42;
  const step = 64;
  return {
    /** Opens the placement picker. */
    place: { x, y: h * 0.8, w: bw, h: 52 },
    /** The picker panel, drawn behind its buttons. */
    panel: { x: x - 8, y: h * 0.26, w: bw + 16, h: h * 0.44 },
    minus: { x, y: pickY - step / 2, w: step, h: step },
    plus: { x: x + bw - step, y: pickY - step / 2, w: step, h: step },
    apply: { x, y: h * 0.55, w: bw, h: 52 },
    cancel: { x, y: h * 0.55 + 64, w: bw, h: 44 },
    /** The sync status label, top right; opens login or retries. */
    sync: { x: w - 124, y: 12, w: 112, h: 36 },
  };
}

/** The end screen's "Study" button, above the continue hint. */
export function studyButton(w: number, h: number): Rect {
  const bw = Math.min(200, w - 48);
  return { x: (w - bw) / 2, y: h - 104, w: bw, h: 44 };
}

/** Whether a tap at (x, y) hits `r`. */
export const hits = (r: Rect, x: number, y: number): boolean => inside(r, x, y);

/** The start screen's sync label, or null when sync is not configured. */
export function syncLabel(status: SyncStatus): string | null {
  switch (status) {
    case "synced":
      return "Synced";
    case "offline":
      return "Offline";
    case "login":
      return "Log in";
    case "disabled":
      return null;
  }
}

const inside = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * The action for a tap at (x, y) on the start screen. Without the picker open
 * the placement button opens it and any other tap starts a run. With it open
 * only its buttons act, so a stray tap never starts a run.
 */
export function startTap(
  picking: boolean,
  w: number,
  h: number,
  x: number,
  y: number,
): Action | null {
  const l = startLayout(w, h);
  if (!picking) return inside(l.place, x, y) ? "place" : "confirm";
  if (inside(l.minus, x, y)) return "left";
  if (inside(l.plus, x, y)) return "right";
  if (inside(l.apply, x, y)) return "confirm";
  if (inside(l.cancel, x, y)) return "back";
  return null;
}

/** Whether a start screen tap (picker closed) hits the sync label. */
export function syncTap(
  status: SyncStatus,
  w: number,
  h: number,
  x: number,
  y: number,
): boolean {
  return syncLabel(status) !== null && inside(startLayout(w, h).sync, x, y);
}
