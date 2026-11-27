import { kanaLevel } from "./run";
import { maxLevel } from "./kanji";
import { defaultProgress, itemKey, LEARNED_BOX } from "./srs";
import type { KanaItem, KanjiItem, Progress, WordItem } from "./types";

/** Placement marks items at this box: known, but drawn rarely (weight 2). */
const PLACED_BOX = 4;

/** Human level names: Hiragana, Katakana, then Kanji 1, Kanji 2, … */
export const levelName = (level: number): string =>
  level === 0 ? "Hiragana" : level === 1 ? "Katakana" : `Kanji ${level - 1}`;

// moved to dependency-free modules so words.ts can use them without a cycle
export { maxLevel } from "./kanji";

/** What `levelItems` and its callers need beyond kana and kanji. */
type Words = readonly WordItem[];

/** One thing to learn: its gate keys (meaning/word first, reading second). */
type LevelItem = {
  char: string;
  part: "kana" | "kanji" | "word";
  keys: string[];
};

/**
 * A level's items: kana levels their kana; kanji levels their kanji (meaning
 * and reading gates) and every word of that level (word and reading gates; a
 * loanword has one). Meaning mode (`meaning`): kanji meaning only, no words.
 */
function levelItems(
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: Words = [],
  meaning = false,
): LevelItem[] {
  if (level < 2)
    return kana
      .filter((k) => kanaLevel(k) === level)
      .map((k) => ({
        char: k.char,
        part: "kana",
        keys: [itemKey(k.char, "kana")],
      }));
  const out: LevelItem[] = kanji
    .filter((k) => k.level === level)
    .map((k) => ({
      char: k.char,
      part: "kanji",
      keys: meaning
        ? [itemKey(k.char, "meaning")]
        : [itemKey(k.char, "meaning"), itemKey(k.char, "reading")],
    }));
  if (!meaning)
    for (const w of words)
      if (w.level === level)
        out.push({
          char: w.word,
          part: "word",
          keys:
            w.kind === "loanword"
              ? [itemKey(w.word, "word")]
              : [itemKey(w.word, "word"), itemKey(w.word, "wordreading")],
        });
  return out;
}

/** Every gate key of a level's items (see `levelItems`). */
export function levelKeys(
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: Words = [],
  meaning = false,
): string[] {
  return levelItems(level, kana, kanji, words, meaning).flatMap((i) => i.keys);
}

const boxOf = (progress: Progress, key: string): number =>
  progress.items[key]?.box ?? 0;

/** Learned: every gate of the item is at LEARNED_BOX or higher, right now. */
const isLearned = (progress: Progress, item: LevelItem): boolean =>
  item.keys.every((k) => boxOf(progress, k) >= LEARNED_BOX);

/** Meaning (first gate) learned but the reading (second gate) not yet. */
const needsReading = (progress: Progress, item: LevelItem): boolean =>
  item.keys.length === 2 &&
  boxOf(progress, item.keys[0] as string) >= LEARNED_BOX &&
  boxOf(progress, item.keys[1] as string) < LEARNED_BOX;

type Count = { learned: number; total: number };

export type LevelProgress = Count & {
  /** Kanji of the level (0/0 on kana levels). */
  kanji: Count;
  /** Words of the level, loanwords included (0/0 on kana levels and in meaning mode). */
  words: Count;
  /** Kanji and kanji words whose meaning is learned but whose reading is not. */
  readingToGo: number;
};

export function levelProgress(
  progress: Progress,
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: Words = [],
  meaning = false,
): LevelProgress {
  const items = levelItems(level, kana, kanji, words, meaning);
  const count = (part: LevelItem["part"] | null): Count => {
    const of = items.filter((i) => part === null || i.part === part);
    return {
      learned: of.filter((i) => isLearned(progress, i)).length,
      total: of.length,
    };
  };
  return {
    ...count(null),
    kanji: count("kanji"),
    words: count("word"),
    readingToGo: items.filter((i) => needsReading(progress, i)).length,
  };
}

/** The end screen's level card: the level after the run and how the run moved it. */
export type LevelCard = LevelProgress & {
  /** The level shown: the unlocked level if the run unlocked one, else the current level. */
  level: number;
  /** Items still to learn for the unlock (total − learned). */
  toUnlock: number;
  /** Items this run newly learned on `level`; 0 when the run unlocked a level. */
  gained: number;
  /**
   * Characters this run newly learned (became learned) on the levels from the
   * one before the run up to `level`, in level order. On an unlock these are
   * the items that finished the old level.
   */
  learnedNow: string[];
  /** The level this run unlocked, else null. */
  unlocked: number | null;
  /** True on the last level: no next level. */
  last: boolean;
};

/**
 * The level card from the progress before and after a run. Counts like
 * `levelProgress` (the start screen's bar), so the bar's "this run" segment is
 * `gained` items after the first `learned - gained`. On an unlock the card shows
 * the new level with `gained` 0.
 */
export function levelCard(
  before: Progress,
  after: Progress,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: Words = [],
  meaning = false,
): LevelCard {
  const level = after.unlockedLevel;
  const p = levelProgress(after, level, kana, kanji, words, meaning);
  const unlocked = level > before.unlockedLevel ? level : null;
  const gained =
    unlocked === null
      ? Math.max(
          0,
          p.learned -
            levelProgress(before, level, kana, kanji, words, meaning).learned,
        )
      : 0;
  const learnedNow: string[] = [];
  for (let l = Math.min(before.unlockedLevel, level); l <= level; l++)
    for (const i of levelItems(l, kana, kanji, words, meaning))
      if (isLearned(after, i) && !isLearned(before, i)) learnedNow.push(i.char);
  return {
    level,
    ...p,
    toUnlock: p.total - p.learned,
    gained,
    learnedNow,
    unlocked,
    last: level >= maxLevel(kanji),
  };
}

/**
 * Progress with every level unlocked that the rule allows: while every item of
 * the current level is learned, the next level unlocks. Never lowers the level.
 */
export function applyUnlock(
  progress: Progress,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: Words = [],
  meaning = false,
): Progress {
  const top = maxLevel(kanji);
  let level = progress.unlockedLevel;
  for (;;) {
    if (level >= top) break;
    const p = levelProgress(progress, level, kana, kanji, words, meaning);
    if (p.total === 0 || p.learned < p.total) break;
    level++;
  }
  return level === progress.unlockedLevel
    ? progress
    : { ...progress, unlockedLevel: level };
}

/**
 * "I already know up to level N" (−1 = none): every item of levels 0..N is
 * raised to box 4 (never lowered) and level N + 1 is unlocked. Re-picking
 * lower undoes an over-placement: the unlocked level becomes N + 1, and
 * placement marks above N that were never answered (seen 0) are removed.
 * Answered items always keep their record. Marks every gate of every item
 * (`levelKeys`): kana, kanji meaning and reading, words and word readings.
 */
export function place(
  progress: Progress,
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: Words = [],
  meaning = false,
): Progress {
  const top = maxLevel(kanji);
  const n = Math.max(-1, Math.min(level, top - 1));
  const items = { ...progress.items };
  const unplaced = new Set<string>();
  const mark = (key: string, l: number): void => {
    const item = items[key];
    if (l <= n) {
      if (!item)
        items[key] = {
          box: PLACED_BOX,
          seen: 0,
          correct: 0,
          wrong: 0,
          lastSeen: 0,
        };
      else if (item.box < PLACED_BOX) items[key] = { ...item, box: PLACED_BOX };
    } else if (item?.seen === 0) unplaced.add(key);
  };
  for (let l = 0; l <= top; l++)
    for (const key of levelKeys(l, kana, kanji, words, meaning)) mark(key, l);
  return {
    ...progress,
    unlockedLevel: n + 1,
    items: Object.fromEntries(
      Object.entries(items).filter(([key]) => !unplaced.has(key)),
    ),
  };
}

/** Meaning mode starts at Kanji 1; kana levels do not exist for it. */
const MEANING_START_LEVEL = 2;

/** Fresh meaning-mode progress: unlocked from Kanji 1 (level 2). */
export function meaningProgress(): Progress {
  return { ...defaultProgress(), unlockedLevel: MEANING_START_LEVEL };
}

/**
 * Meaning-mode placement: "I know up to level N" with N ≥ 1 (1 = none, start at
 * Kanji 1). Passes no kana, so it creates no kana records; the lowest result is
 * level 2. Same rules as `place` otherwise.
 */
export function placeMeaning(
  progress: Progress,
  level: number,
  kanji: readonly KanjiItem[],
): Progress {
  return place(progress, Math.max(1, level), [], kanji, [], true);
}
