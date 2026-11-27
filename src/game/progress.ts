import type { LevelPage, LevelPageItem } from "../core/levelpage";
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

const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** What a tap on the overall view hits: Back, a group row, a level row, or nothing. */
export type ProgressHit =
  | { kind: "back" }
  | { kind: "group"; group: number }
  | { kind: "level"; level: number }
  | null;

/** The row under (x, y) in a list from `top` to `bottom` scrolled by `scroll`, if any. */
function rowAt<R extends { y: number; h: number }>(
  rows: readonly R[],
  top: number,
  bottom: number,
  scroll: number,
  y: number,
): R | undefined {
  if (y < top || y > bottom) return undefined;
  const at = y - top + scroll;
  return rows.find((r) => at >= r.y && at < r.y + r.h);
}

/** What a tap at (x, y) on the overall view, scrolled by `scroll`, hits. */
export function progressHit(
  w: number,
  h: number,
  view: Overall,
  scroll: number | null,
  x: number,
  y: number,
): ProgressHit {
  const l = progressLayout(w, h, view);
  if (inRect(l.back, x, y)) return { kind: "back" };
  if (x < PAD || x > w - PAD) return null;
  const s = resolveScroll(scroll, l.maxScroll);
  const row = rowAt(l.rows, l.listTop, l.listBottom, s, y)?.row;
  if (!row) return null;
  return row.kind === "group"
    ? { kind: "group", group: row.group }
    : { kind: "level", level: row.level };
}

/** Level page rows (px). */
const ITEM_H = 48;
/** Where the level page's list starts: below the title, count and bar. */
const PAGE_LIST_TOP = 126;

/** A level page row at `y` from the top of the list's content (before scrolling). */
type PlacedItem = { item: LevelPageItem; y: number; h: number };

/** The level page's layout: Back at the bottom, the item rows between the header and Back. */
export function levelPageLayout(w: number, h: number, page: LevelPage) {
  const back = { x: PAD, y: h - 24 - 48, w: w - 2 * PAD, h: 48 };
  const listTop = PAGE_LIST_TOP;
  const listBottom = back.y - 12;
  const rows: PlacedItem[] = page.items.map((item, i) => ({
    item,
    y: i * ITEM_H,
    h: ITEM_H,
  }));
  return {
    back,
    listTop,
    listBottom,
    rows,
    /** The list scrolls between 0 and this. */
    maxScroll: Math.max(0, rows.length * ITEM_H - (listBottom - listTop)),
  };
}

/** What a tap on the level page hits: Back, an item row (its key and kind), or nothing. */
export type LevelPageHit =
  | { kind: "back" }
  | { kind: "item"; item: Pick<LevelPageItem, "key" | "kind"> }
  | null;

export function levelPageHit(
  w: number,
  h: number,
  page: LevelPage,
  scroll: number,
  x: number,
  y: number,
): LevelPageHit {
  const l = levelPageLayout(w, h, page);
  if (inRect(l.back, x, y)) return { kind: "back" };
  if (x < PAD || x > w - PAD) return null;
  const s = clampScroll(scroll, l.maxScroll);
  const r = rowAt(l.rows, l.listTop, l.listBottom, s, y);
  return r
    ? { kind: "item", item: { key: r.item.key, kind: r.item.kind } }
    : null;
}

/** The scroll offset after moving the list by `dy` px (positive = further down). */
export const scrollBy = (
  scroll: number | null,
  dy: number,
  max: number,
): number => clampScroll(resolveScroll(scroll, max) + dy, max);
