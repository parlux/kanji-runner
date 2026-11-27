import type { RunItem } from "../core/runitems";
import { stageName } from "../core/srs";
import type { LevelCard } from "../core/progression";
import type { GateType } from "../core/types";
import { levelCardHeight } from "./screens/levelcard";
import { endLayout } from "./start";

/** The end screen's vertical rhythm: gap between blocks, and where the level card starts (px). */
export const endGap = (h: number): number => (h < 760 ? 10 : 18);
const CARD_TOP = (h: number): number =>
  (h < 760 ? 22 : 40) + 50 + 26 + endGap(h);

/**
 * Where the item list sits: below the level card, above the Play button.
 * Returns the px range `[top, bottom]`.
 */
export function endListArea(
  w: number,
  h: number,
  card: LevelCard,
  study: boolean,
): { top: number; bottom: number } {
  const gap = endGap(h);
  return {
    top: CARD_TOP(h) + levelCardHeight(card, h < 760) + gap,
    bottom: endLayout(w, h, study).play.y - gap,
  };
}

/** Gap between rows, and the extra height of a row that shows its right answer (px). */
const ROW_GAP = 2;
const ANSWER_H = 16;
/** Row height (without the gap) at most / least; a long list scrolls at the least. */
const ROW_MAX = 32;
const ROW_MIN = 20;

/** An item row at `y` from the top of the list's content (before scrolling). */
type EndRow = { item: RunItem; y: number; h: number };

/** Whether the row shows the right answer under the item: any gate missed. */
const showsAnswer = (item: RunItem): boolean =>
  item.gates.some((g) => g.missed);

/**
 * The end screen's item list between `top` and `bottom`: rows stacked from 0
 * (thinner as the list grows, never under ROW_MIN), the content height and
 * how far it scrolls. Rows with an answer line are taller.
 */
export function endListLayout(top: number, bottom: number, items: RunItem[]) {
  const avail = bottom - top;
  const extra = items.filter(showsAnswer).length * ANSWER_H;
  const n = Math.max(1, items.length);
  const row = Math.max(
    ROW_MIN,
    Math.min(ROW_MAX, (avail - extra) / n - ROW_GAP),
  );
  let y = 0;
  const rows: EndRow[] = items.map((item) => {
    const h = row + (showsAnswer(item) ? ANSWER_H : 0);
    const placed = { item, y, h };
    y += h + ROW_GAP;
    return placed;
  });
  const content = Math.max(0, y - ROW_GAP);
  return {
    top,
    bottom,
    rows,
    content,
    /** The list scrolls between 0 and this. */
    maxScroll: Math.max(0, content - avail),
  };
}

/** The colour role of a row: slips and any missed gate bad, new and up good, same dim. */
export const rowTone = (item: RunItem): "good" | "bad" | "dim" =>
  showsAnswer(item) || item.change === "slip"
    ? "bad"
    : item.change === "same"
      ? "dim"
      : "good";

const isMeaning = (g: GateType): boolean => g === "meaning" || g === "word";

/**
 * The stage change on a row's right: "Recalled → Learned", or just the stage when
 * the box didn't move ("Strong"); both gates asked: "M Met → Recalled · R New → Met".
 */
export function changeText(item: RunItem): string {
  const part = (from: number, to: number): string =>
    from === to ? stageName(to) : `${stageName(from)} → ${stageName(to)}`;
  const gates = [...item.gates].sort(
    (a, b) => Number(isMeaning(b.gate)) - Number(isMeaning(a.gate)),
  );
  if (gates.length === 1) {
    const g = gates[0];
    return g ? part(g.from, g.to) : "";
  }
  return gates
    .map((g) => `${isMeaning(g.gate) ? "M" : "R"} ${part(g.from, g.to)}`)
    .join(" · ");
}

/** The right answers of the missed gates ("にち・じつ"), for the second line. */
export const answerText = (item: RunItem): string =>
  item.gates
    .filter((g) => g.missed)
    .map((g) => (g.answers ?? []).join(isMeaning(g.gate) ? " · " : "・"))
    .filter(Boolean)
    .join(" · ");

/** `s` cut to fit `maxW` by `measure`, ending in "…"; "" when not even one char fits. */
export function truncate(
  s: string,
  maxW: number,
  measure: (t: string) => number,
): string {
  if (measure(s) <= maxW) return s;
  let n = s.length;
  while (n > 0 && measure(`${s.slice(0, n).trimEnd()}…`) > maxW) n--;
  return n > 0 ? `${s.slice(0, n).trimEnd()}…` : "";
}
