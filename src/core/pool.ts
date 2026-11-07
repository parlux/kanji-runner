import { itemKey, READING_UNLOCK_BOX, weight } from "./srs";
import type { KanaItem, KanjiItem, Progress } from "./types";

/** Level 0 is hiragana, level 1 katakana. */
export const kanaLevel = (k: KanaItem): number =>
  k.script === "hiragana" ? 0 : 1;

/** One askable item: a kana, or a kanji as a meaning or a reading gate. */
export type Entry =
  | { key: string; type: "kana"; item: KanaItem }
  | { key: string; type: "meaning" | "reading"; item: KanjiItem };

/**
 * Every unlocked item, in progression order: kana, then kanji by level. A
 * kanji's reading follows its meaning, once the meaning box is ≥ 3.
 */
export function unlockedPool(
  progress: Progress,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): Entry[] {
  const level = progress.unlockedLevel;
  const out: Entry[] = [];
  for (const k of kana)
    if (kanaLevel(k) <= level)
      out.push({ key: itemKey(k.char, "kana"), type: "kana", item: k });
  for (const k of kanji) {
    if (k.level > level) continue;
    const key = itemKey(k.char, "meaning");
    out.push({ key, type: "meaning", item: k });
    if ((progress.items[key]?.box ?? 0) >= READING_UNLOCK_BOX)
      out.push({ key: itemKey(k.char, "reading"), type: "reading", item: k });
  }
  return out;
}

/** How a run picks its prompts from a pool. */
export type Selection = {
  /** Askable items in progression order; new items are introduced in this order. */
  entries: readonly Entry[];
  /** The item's box for selection: its record's, else a seeded box, else 0. */
  box: (e: Entry) => number;
  /** Known items are drawn by weight; the rest are new (at most 4 per run). */
  known: (e: Entry) => boolean;
  weight: (e: Entry) => number;
  /** Warm-ups prefer these, once there are enough of them. */
  current: (e: Entry) => boolean;
};

/** Everything a run is built from: selection plus the distractor sources. */
export type Pool = Selection & {
  /** Kana and kanji that distractors are drawn from. */
  kana: readonly KanaItem[];
  kanji: readonly KanjiItem[];
  /** Kanji ranked most confusable with `char`, before shared components. */
  similar: (char: string) => readonly string[];
};

const NONE: readonly string[] = [];

/** Built-in selection rules for a list of entries: the v1 SRS. */
export function builtInSelection(
  progress: Progress,
  entries: readonly Entry[],
): Selection {
  const record = (e: Entry) => progress.items[e.key];
  const box = (e: Entry): number => record(e)?.box ?? 0;
  return {
    entries,
    box,
    known: (e) => record(e) !== undefined,
    weight: (e) => weight(box(e)),
    current: (e) =>
      (e.type === "kana" ? kanaLevel(e.item) : e.item.level) ===
      progress.unlockedLevel,
  };
}

/**
 * Built-in mode: the unlocked levels, as in v1. Distractors draw on unlocked
 * items plus the next level.
 */
export function builtInPool(
  progress: Progress,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): Pool {
  const next = progress.unlockedLevel + 1;
  return {
    ...builtInSelection(progress, unlockedPool(progress, kana, kanji)),
    kana: kana.filter((k) => kanaLevel(k) <= next),
    kanji: kanji.filter((k) => k.level <= next),
    similar: () => NONE,
  };
}
