import type { SyncStatus } from "../sync/sync";
import type { Action } from "./input";

export type Rect = { x: number; y: number; w: number; h: number };

/** Start screen controls, shared by the renderer and tap hit-testing. */
export function startLayout(w: number, h: number) {
  const bw = Math.min(320, w - 48);
  const x = (w - bw) / 2;
  const pickY = h * 0.42;
  const step = 64;
  const modeY = h * 0.27;
  const play = { x, y: h - 190, w: bw, h: 60 };
  return {
    /** The settings gear, top right. */
    settings: { x: w - 56, y: 8, w: 44, h: 44 },
    /** The sync alert (offline / log in), left of the gear; hidden when fine. */
    sync: { x: w - 56 - 124, y: 12, w: 116, h: 36 },
    /** The Normal / Meanings only switch, two halves. */
    modeNormal: { x, y: modeY, w: bw / 2, h: 60 },
    modeMeaning: { x: x + bw / 2, y: modeY, w: bw / 2, h: 60 },
    /** Starts a run. */
    play,
    /** "I already know some…": opens the placement picker. */
    place: { x, y: play.y + play.h + 8, w: bw, h: 40 },
    /** The picker panel, drawn behind its buttons. */
    panel: { x: x - 8, y: h * 0.26, w: bw + 16, h: h * 0.44 },
    minus: { x, y: pickY - step / 2, w: step, h: step },
    plus: { x: x + bw - step, y: pickY - step / 2, w: step, h: step },
    apply: { x, y: h * 0.55, w: bw, h: 52 },
    cancel: { x, y: h * 0.55 + 64, w: bw, h: 44 },
    /** The build stamp, bottom centre: five quick taps toggle the camera gear. */
    stamp: { x: w / 2 - 80, y: h - 20, w: 160, h: 20 },
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

/** Whether the sync label shows on the start screen: only when it needs attention. */
export const syncAlert = (status: SyncStatus): boolean =>
  status === "offline" || status === "login";

const inside = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * The action for a tap at (x, y) on the start screen. Without the picker open
 * Play starts a run and "I already know some…" opens the picker; other taps do
 * nothing. With it open only its buttons act.
 */
export function startTap(
  picking: boolean,
  w: number,
  h: number,
  x: number,
  y: number,
  placement = true,
): Action | null {
  const l = startLayout(w, h);
  if (!picking) {
    if (inside(l.play, x, y)) return "confirm";
    return placement && inside(l.place, x, y) ? "place" : null;
  }
  if (inside(l.minus, x, y)) return "left";
  if (inside(l.plus, x, y)) return "right";
  if (inside(l.apply, x, y)) return "confirm";
  if (inside(l.cancel, x, y)) return "back";
  return null;
}

/** Whether a start screen tap (picker closed) hits the sync alert. */
export function syncTap(
  status: SyncStatus,
  w: number,
  h: number,
  x: number,
  y: number,
): boolean {
  return syncAlert(status) && inside(startLayout(w, h).sync, x, y);
}

/** Whether a start screen tap (picker closed) hits the settings gear. */
export function settingsTap(
  w: number,
  h: number,
  x: number,
  y: number,
): boolean {
  return inside(startLayout(w, h).settings, x, y);
}

/** The mode a start screen tap (picker closed) picks on the switch, or null. */
export function modeTap(
  w: number,
  h: number,
  x: number,
  y: number,
): "normal" | "meaning" | null {
  const l = startLayout(w, h);
  if (inside(l.modeNormal, x, y)) return "normal";
  if (inside(l.modeMeaning, x, y)) return "meaning";
  return null;
}

/** Taps on the build stamp that toggle the camera gear, and the seconds they must come within. */
export const STAMP_TAPS = 5;
export const STAMP_WINDOW = 3;

/** Whether a start screen tap (picker closed) hits the build stamp. */
export function stampTap(w: number, h: number, x: number, y: number): boolean {
  return inside(startLayout(w, h).stamp, x, y);
}

/**
 * Adds a stamp tap at time `now` (s) to the recent `taps`: the taps within
 * STAMP_WINDOW, and whether this one is the STAMP_TAPS-th (which starts over).
 */
export function stampTapped(
  taps: readonly number[],
  now: number,
): { taps: number[]; toggle: boolean } {
  const recent = [...taps, now].filter((t) => now - t <= STAMP_WINDOW);
  return recent.length >= STAMP_TAPS
    ? { taps: [], toggle: true }
    : { taps: recent, toggle: false };
}
