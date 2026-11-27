import type { RunItem } from "../core/runitems";
import { stageName } from "../core/srs";
import type { LevelCard } from "../core/progression";
import type { LevelPage } from "../core/levelpage";
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

/** Gap between rows, the extra height of a row that shows its right answer, a section label's height (px). */
const ROW_GAP = 2;
const ANSWER_H = 16;
const LABEL_H = 20;
/** Row height (without the gap) at most / least (compact screens: least 24); a long list scrolls at the least. */
const ROW_MAX = 32;
const rowMin = (compact: boolean): number => (compact ? 24 : 30);

/** Which part of the end list a row is in (SPEC-run-items §5). */
type EndSection = "missing" | "learned" | "also";

/**
 * One end-list row: an item of the level card's level (missing or learned),
 * or another item met this run. `met` is how this run moved it, if it was met.
 */
export type EndEntry = {
  key: string;
  kind: RunItem["kind"];
  meaning: string;
  section: EndSection;
  /** The level page's stages ("M Learned · R Met"); "" for "also" rows. */
  stages: string;
  met?: RunItem;
};

/**
 * The end list's rows: the level's missing items, then its learned ones
 * (teaching order, as `page.items` has them), then every other item met this
 * run in `items` order.
 */
export function endEntries(
  page: LevelPage,
  items: readonly RunItem[],
): EndEntry[] {
  const id = (i: { key: string; kind: string }): string => `${i.kind}:${i.key}`;
  const met = new Map(items.map((i) => [id(i), i]));
  const level = page.items.map((p): EndEntry => {
    const m = met.get(id(p));
    return {
      key: p.key,
      kind: p.kind,
      meaning: p.meaning ?? p.reading ?? "",
      section: p.learned ? "learned" : "missing",
      stages: p.stages,
      ...(m ? { met: m } : {}),
    };
  });
  const inLevel = new Set(page.items.map(id));
  const also = items
    .filter((i) => !inLevel.has(id(i)))
    .map((i): EndEntry => ({
      key: i.key,
      kind: i.kind,
      meaning: i.meaning,
      section: "also",
      stages: "",
      met: i,
    }));
  return [
    ...level.filter((e) => e.section === "missing"),
    ...level.filter((e) => e.section === "learned"),
    ...also,
  ];
}

/** A row at `y` from the top of the list's content (before scrolling). */
type EndRow = { entry: EndEntry; y: number; h: number };
/** A section label ("Missing 5") whose text is centred on `y`, in content coordinates. */
type EndLabel = { text: string; y: number };

const LABELS: Record<EndSection, (n: number) => string> = {
  missing: (n) => `Missing ${n}`,
  learned: (n) => `Learned ${n}`,
  also: () => "Also this run",
};

/**
 * Missed gates whose right answer the row doesn't already show: readings. A
 * missed meaning (or kana, or loanword) answer is the meaning on the row itself.
 */
const answerGates = (item: RunItem) =>
  item.gates.filter(
    (g) => g.missed && (g.gate === "reading" || g.gate === "wordreading"),
  );

/** Whether the row shows the right answer under the item: a reading missed. */
const showsAnswer = (item: RunItem): boolean => answerGates(item).length > 0;
const hasAnswer = (e: EndEntry): boolean =>
  e.met !== undefined && showsAnswer(e.met);

/**
 * The end screen's list between `top` and `bottom`: a small label over each
 * non-empty section, rows stacked from 0 (thinner as the list grows, never
 * under the least), the content height and how far it scrolls. Rows with an
 * answer line are taller.
 */
export function endListLayout(
  top: number,
  bottom: number,
  entries: readonly EndEntry[],
  compact = false,
) {
  const avail = bottom - top;
  const sections = (["missing", "learned", "also"] as const).filter((s) =>
    entries.some((e) => e.section === s),
  );
  const extra =
    entries.filter(hasAnswer).length * ANSWER_H + sections.length * LABEL_H;
  const n = Math.max(1, entries.length);
  const row = Math.max(
    rowMin(compact),
    Math.min(ROW_MAX, (avail - extra) / n - ROW_GAP),
  );
  let y = 0;
  const rows: EndRow[] = [];
  const labels: EndLabel[] = [];
  for (const s of sections) {
    const part = entries.filter((e) => e.section === s);
    labels.push({ text: LABELS[s](part.length), y: y + LABEL_H / 2 });
    y += LABEL_H;
    for (const entry of part) {
      const h = row + (hasAnswer(entry) ? ANSWER_H : 0);
      rows.push({ entry, y, h });
      y += h + ROW_GAP;
    }
  }
  const content = Math.max(0, y - ROW_GAP);
  return {
    top,
    bottom,
    rows,
    labels,
    content,
    /** The list scrolls between 0 and this. */
    maxScroll: Math.max(0, content - avail),
  };
}

/**
 * The row under a tap at (x, y) on the list scrolled by `scroll` (already
 * clamped), or null: off the list area, between rows, on a label, or outside
 * the rows' left and right edges (`pad` from the screen's sides).
 */
export function endListHit(
  list: ReturnType<typeof endListLayout>,
  scroll: number,
  w: number,
  pad: number,
  x: number,
  y: number,
): EndEntry | null {
  if (y < list.top || y > list.bottom || x < pad || x > w - pad) return null;
  const at = y - list.top + scroll;
  return list.rows.find((r) => at >= r.y && at < r.y + r.h)?.entry ?? null;
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

/** The right readings of the missed reading gates ("にち・じつ"), for the second line. */
export const answerText = (item: RunItem): string =>
  answerGates(item)
    .map((g) => (g.answers ?? []).join("・"))
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
