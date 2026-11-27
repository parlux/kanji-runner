import type { Overall, OverallRow } from "../core/overall";
import type { Rect } from "./start";

/** Row heights of the overall view's list (px). */
const GROUP_H = 54;
const LEVEL_H = 42;
const PAD = 20;

/** A list row at `y` from the top of the list's content (before scrolling). */
type PlacedRow = { row: OverallRow; y: number; h: number };

/**
 * The overall view's layout: the header lines, the Back button at the bottom,
 * the list between them and how far it can scroll.
 */
export function progressLayout(w: number, h: number, view: Overall) {
  const back = { x: PAD, y: h - 24 - 48, w: w - 2 * PAD, h: 48 };
  // below the header: the coverage line and its gain note, when shown
  const listTop = view.coverage === null ? 140 : view.gain === null ? 176 : 204;
  const listBottom = back.y - 12;
  let y = 0;
  const rows: PlacedRow[] = view.rows.map((row) => {
    const rh = row.kind === "group" ? GROUP_H : LEVEL_H;
    const placed = { row, y, h: rh };
    y += rh;
    return placed;
  });
  return {
    back,
    listTop,
    listBottom,
    rows,
    /** The list scrolls between 0 and this. */
    maxScroll: Math.max(0, y - (listBottom - listTop)),
  };
}

/** A scroll offset kept within the list. */
export const clampScroll = (s: number, max: number): number =>
  Math.max(0, Math.min(max, s));

/**
 * The scroll offset to draw with: `scroll`, clamped; null (just opened) scrolls
 * to the end, where the current level and what's next are.
 */
export const resolveScroll = (scroll: number | null, max: number): number =>
  scroll === null ? max : clampScroll(scroll, max);

/** Whether a tap at (x, y) on the overall view hits Back. */
export function progressTap(
  w: number,
  h: number,
  view: Overall,
  x: number,
  y: number,
): boolean {
  const r: Rect = progressLayout(w, h, view).back;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** The scroll offset after moving the list by `dy` px (positive = further down). */
export const scrollBy = (
  scroll: number | null,
  dy: number,
  max: number,
): number => clampScroll(resolveScroll(scroll, max) + dy, max);
