import { itemKey, READING_UNLOCK_BOX, weight } from "./srs";
import { WK_DUE_BOOST } from "./tuning";
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

/** What WaniKani mode needs per kanji; `WkExtras` from `src/wanikani` fits. */
export type WkPoolExtras = {
  /** WaniKani SRS stage, 1–9. */
  srsStage: number;
  /** Available for review on WaniKani now. */
  due: boolean;
  /** Visually similar kanji in the list. */
  similar: readonly string[];
};

/** The taught WaniKani kanji; `WkList` from `src/wanikani` fits. */
export type WkPoolInput = {
  kanji: readonly KanjiItem[];
  extras: ReadonlyMap<string, WkPoolExtras>;
};

/** A kanji's box before its first answer in WaniKani mode, from its WaniKani stage. */
export function seededBox(stage: number): number {
  if (stage <= 2) return 1;
  if (stage <= 4) return 2;
  if (stage <= 6) return 3;
  if (stage === 7) return 4;
  return 5;
}

/**
 * WaniKani mode: every taught kanji, plus kana by the v1 rules. A kanji with
 * no record counts as known, at the box seeded from its WaniKani stage (never
 * written), so no new-items cap applies to it. Weight is 2^(5 − box), times
 * `WK_DUE_BOOST` when the kanji is due on WaniKani. Readings unlock at
 * meaning box ≥ 3, seeded or real. Distractors draw on the taught kanji,
 * `similar` first.
 */
export function wanikaniPool(
  progress: Progress,
  kana: readonly KanaItem[],
  list: WkPoolInput,
): Pool {
  const record = (e: Entry) => progress.items[e.key];
  const extras = (e: Entry) =>
    e.type === "kana" ? undefined : list.extras.get(e.item.char);
  const box = (e: Entry): number => {
    const r = record(e);
    if (r) return r.box;
    const x = extras(e);
    return x ? seededBox(x.srsStage) : 0;
  };
  const entries: Entry[] = unlockedPool(progress, kana, []);
  for (const k of list.kanji) {
    const meaning: Entry = {
      key: itemKey(k.char, "meaning"),
      type: "meaning",
      item: k,
    };
    entries.push(meaning);
    if (box(meaning) >= READING_UNLOCK_BOX)
      entries.push({
        key: itemKey(k.char, "reading"),
        type: "reading",
        item: k,
      });
  }
  const next = progress.unlockedLevel + 1;
  return {
    entries,
    box,
    known: (e) => record(e) !== undefined || extras(e) !== undefined,
    weight: (e) => weight(box(e)) * (extras(e)?.due ? WK_DUE_BOOST : 1),
    // warm-ups: the highest-box known items of the whole pool
    current: () => true,
    kana: kana.filter((k) => kanaLevel(k) <= next),
    kanji: list.kanji,
    similar: (char) => list.extras.get(char)?.similar ?? NONE,
  };
}
