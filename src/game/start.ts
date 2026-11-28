import type { SyncStatus } from "../sync/sync";
import type { AudioSettings } from "../audio/settings";
import type { Action } from "./input";

export type Rect = { x: number; y: number; w: number; h: number };

const TOGGLE_KINDS = ["voice", "sfx", "music"] as const;
const TOGGLE_GAP = 8;
/** The switches' settings keys, in the order they are drawn. */
export type ToggleKind = (typeof TOGGLE_KINDS)[number];

/** The run's mute button: top centre, between the question count and the streak. */
export const muteRect = (w: number): Rect => ({
  x: w / 2 - 24,
  y: 4,
  w: 48,
  h: 48,
});

/** Start screen controls, shared by the renderer and tap hit-testing. */
export function startLayout(w: number, h: number) {
  const bw = Math.min(320, w - 48);
  const x = (w - bw) / 2;
  const pickY = h * 0.42;
  const step = 64;
  const modeY = h * 0.27;
  const togW = (bw - 2 * TOGGLE_GAP) / 3;
  const play = { x, y: h - 190, w: bw, h: 60 };
  return {
    /** The settings gear, top right. */
    settings: { x: w - 56, y: 8, w: 44, h: 44 },
    /** The sync alert (offline / log in), left of the gear; hidden when fine. */
    sync: { x: w - 56 - 124, y: 12, w: 116, h: 36 },
    /** The Normal / Meanings only switch, two halves. */
    modeNormal: { x, y: modeY, w: bw / 2, h: 60 },
    modeMeaning: { x: x + bw / 2, y: modeY, w: bw / 2, h: 60 },
    /** The level block (name, bar, counts, "Progress ›"): opens the overall view. */
    progress: { x, y: h * 0.46 - 24, w: bw, h: 122 },
    /** Starts a run. */
    play,
    /** "I already know some…": opens the placement picker. */
    place: { x, y: play.y + play.h + 8, w: bw, h: 40 },
    /** The picker panel, drawn behind its buttons. */
    panel: { x: x - 8, y: h * 0.26, w: bw + 16, h: h * 0.29 + 180 },
    minus: { x, y: pickY - step / 2, w: step, h: step },
    plus: { x: x + bw - step, y: pickY - step / 2, w: step, h: step },
    /** −10 / +10: 296 kanji levels are too many to step one by one. */
    minusTen: { x, y: h * 0.55, w: (bw - 12) / 2, h: 44 },
    plusTen: { x: x + (bw + 12) / 2, y: h * 0.55, w: (bw - 12) / 2, h: 44 },
    apply: { x, y: h * 0.55 + 56, w: bw, h: 52 },
    cancel: { x, y: h * 0.55 + 120, w: bw, h: 44 },
    /** Voice / Sound / Music switches in a row, above Play (thumb-sized). */
    toggles: TOGGLE_KINDS.map((kind, i) => ({
      kind,
      rect: {
        x: x + i * (togW + TOGGLE_GAP),
        y: play.y - 84,
        w: togW,
        h: 52,
      },
    })),
    /** The build stamp, bottom centre (not a button: a tap there starts nothing). */
    stamp: { x: w / 2 - 80, y: h - 20, w: 160, h: 20 },
  };
}

/** Side margin and bottom padding of the end screen's buttons (px). */
const END_PAD = 20;
const END_BOTTOM = 24;
const END_GAP = 10;

/**
 * The end screen's buttons, at the bottom: Play again full width, then Study
 * and Home side by side; Home takes the full width when Study isn't offered.
 */
export function endLayout(
  w: number,
  h: number,
  study: boolean,
): { play: Rect; study: Rect | null; home: Rect } {
  const bw = w - 2 * END_PAD;
  const rowY = h - END_BOTTOM - 48;
  const half = (bw - END_GAP) / 2;
  return {
    play: { x: END_PAD, y: rowY - END_GAP - 52, w: bw, h: 52 },
    study: study ? { x: END_PAD, y: rowY, w: half, h: 48 } : null,
    home: study
      ? { x: END_PAD + half + END_GAP, y: rowY, w: half, h: 48 }
      : { x: END_PAD, y: rowY, w: bw, h: 48 },
  };
}

/** The action for a tap at (x, y) on the end screen; a tap off the buttons does nothing. */
export function endTap(
  study: boolean,
  w: number,
  h: number,
  x: number,
  y: number,
): Action | null {
  const l = endLayout(w, h, study);
  if (inside(l.play, x, y)) return "confirm";
  if (l.study && inside(l.study, x, y)) return "study";
  if (inside(l.home, x, y)) return "back";
  return null;
}

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
 * Play starts a run, the level block opens the overall view and "I already
 * know some…" opens the picker; other taps do
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
    if (inside(l.progress, x, y)) return "progress";
    return placement && inside(l.place, x, y) ? "place" : null;
  }
  if (inside(l.minus, x, y)) return "left";
  if (inside(l.plus, x, y)) return "right";
  if (inside(l.minusTen, x, y)) return "leftTen";
  if (inside(l.plusTen, x, y)) return "rightTen";
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

/** The switch a start screen tap (picker closed) hits, or null. */
export function toggleTap(
  w: number,
  h: number,
  x: number,
  y: number,
): ToggleKind | null {
  return (
    startLayout(w, h).toggles.find((t) => inside(t.rect, x, y))?.kind ?? null
  );
}

/** Whether a tap in a run hits the mute button. */
export const muteTap = (w: number, x: number, y: number): boolean =>
  inside(muteRect(w), x, y);

/** The settings after a switch is tapped. */
export const toggled = (s: AudioSettings, kind: ToggleKind): AudioSettings => ({
  ...s,
  [kind]: !s[kind],
});
