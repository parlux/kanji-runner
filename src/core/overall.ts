import { travelCoverage } from "./coverage";
import {
  groupLevels,
  groupName,
  groupOf,
  levelName,
  levelProgress,
  maxLevel,
} from "./progression";
import { itemKey, LEARNED_BOX } from "./srs";
import type { KanaItem, KanjiItem, Progress, WordItem } from "./types";

/** One row of the overall view's list (SPEC-overall-progress §4). */
export type OverallRow =
  | {
      kind: "group";
      name: string;
      /** "Kanji 1–25" or "Hiragana–Katakana". */
      range: string;
      /** Levels whose items are all learned now, of the group's levels. */
      finished: number;
      levels: number;
      /** The current group: its level rows follow. */
      open: boolean;
      /** The next group, not reached yet. */
      dim: boolean;
    }
  | {
      kind: "level";
      level: number;
      name: string;
      learned: number;
      total: number;
      dim: boolean;
    };

export type Overall = {
  level: number;
  /** "Kanji 9 of 296 · Foundations", "Hiragana · Kana". */
  title: string;
  /** Kanji learned by the live rule, of all kanji. */
  learned: number;
  all: number;
  /** Share of travel-text kanji readable now; null in meaning mode. */
  coverage: number | null;
  /** What finishing the current level would add; null in meaning mode and on kana levels. */
  gain: number | null;
  rows: OverallRow[];
};

/** A kanji is learned when meaning and reading are at LEARNED_BOX (meaning mode: meaning only). */
const kanjiLearned = (
  progress: Progress,
  char: string,
  meaning: boolean,
): boolean =>
  (progress.items[itemKey(char, "meaning")]?.box ?? 0) >= LEARNED_BOX &&
  (meaning ||
    (progress.items[itemKey(char, "reading")]?.box ?? 0) >= LEARNED_BOX);

/**
 * The overall view's data: header, coverage and rows. Groups from the first
 * (Kana; meaning mode: Foundations) up to the current one, past groups as one
 * row, the current group open (its levels up to the unlocked one, then the next
 * level dimmed), then the next group dimmed.
 */
export function overall(
  progress: Progress,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: readonly WordItem[],
  meaning: boolean,
): Overall {
  const max = maxLevel(kanji);
  const level = Math.max(meaning ? 2 : 0, progress.unlockedLevel);
  const group = groupOf(level);
  const lp = (l: number) =>
    levelProgress(progress, l, kana, kanji, words, meaning);
  const finished = (l: number): boolean => {
    const p = lp(l);
    return p.total > 0 && p.learned === p.total;
  };
  const levelRow = (l: number, dim: boolean): OverallRow => {
    const p = lp(l);
    return {
      kind: "level",
      level: l,
      name: levelName(l),
      learned: p.learned,
      total: p.total,
      dim,
    };
  };
  const groupRow = (g: number, open: boolean, dim: boolean): OverallRow => {
    const { first, last } = groupLevels(g, max);
    let done = 0;
    for (let l = first; l <= last; l++) if (finished(l)) done++;
    return {
      kind: "group",
      name: groupName(g),
      range: `${levelName(first)}–${levelName(last).replace("Kanji ", "")}`,
      finished: done,
      levels: last - first + 1,
      open,
      dim,
    };
  };

  const rows: OverallRow[] = [];
  for (let g = meaning ? 1 : 0; g < group; g++)
    rows.push(groupRow(g, false, false));
  rows.push(groupRow(group, true, false));
  for (let l = groupLevels(group, max).first; l <= level; l++)
    rows.push(levelRow(l, false));
  if (level < max) rows.push(levelRow(level + 1, true));
  if (groupOf(max) > group) rows.push(groupRow(group + 1, false, true));

  const known = new Set(
    kanji
      .filter((k) => kanjiLearned(progress, k.char, meaning))
      .map((k) => k.char),
  );
  let coverage: number | null = null;
  let gain: number | null = null;
  if (!meaning) {
    coverage = travelCoverage((c) => known.has(c));
    if (level >= 2) {
      const here = new Set(
        kanji.filter((k) => k.level === level).map((k) => k.char),
      );
      gain = travelCoverage((c) => known.has(c) || here.has(c)) - coverage;
    }
  }
  const title =
    level < 2
      ? `${levelName(level)} · ${groupName(0)}`
      : `${levelName(level)} of ${max - 1} · ${groupName(group)}`;
  return {
    level,
    title,
    learned: known.size,
    all: kanji.length,
    coverage,
    gain,
    rows,
  };
}

/** "+1%", "+<1%" for a gain under half a percent but above zero, "+0%" for none. */
export const gainLabel = (gain: number): string => {
  const pct = Math.round(gain * 100);
  return pct === 0 && gain > 0 ? "+<1%" : `+${pct}%`;
};
