import { kanaLevel } from "./run";
import { maxLevel } from "./kanji";
import { defaultProgress, itemKey, LEARNED_BOX } from "./srs";
import type { KanaItem, KanjiItem, Progress, WordItem } from "./types";

/** Placement marks items at this box: known, but drawn rarely (weight 2). */
export const PLACED_BOX = 4;
/** The next level unlocks when this share of the current level is learned. */
export const UNLOCK_SHARE = 0.8;

/** Human level names: Hiragana, Katakana, then Kanji 1, Kanji 2, … */
export const levelName = (level: number): string =>
  level === 0 ? "Hiragana" : level === 1 ? "Katakana" : `Kanji ${level - 1}`;

// moved to dependency-free modules so words.ts can use them without a cycle
export { maxLevel } from "./kanji";
export { LEARNED_BOX } from "./srs";

/** Item keys of a level for its primary gate type: kana, or kanji meaning. */
export function levelKeys(
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): string[] {
  return levelItems(level, kana, kanji).map((i) => i.key);
}

/** A level's characters with their item keys, as `levelKeys` counts them. */
function levelItems(
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): { char: string; key: string }[] {
  if (level < 2)
    return kana
      .filter((k) => kanaLevel(k) === level)
      .map((k) => ({ char: k.char, key: itemKey(k.char, "kana") }));
  return kanji
    .filter((k) => k.level === level)
    .map((k) => ({ char: k.char, key: itemKey(k.char, "meaning") }));
}

export type LevelProgress = {
  learned: number;
  total: number;
  /** Learned items needed to unlock the next level. */
  needed: number;
};

export function levelProgress(
  progress: Progress,
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): LevelProgress {
  const keys = levelKeys(level, kana, kanji);
  const learned = keys.filter(
    (k) => (progress.items[k]?.box ?? 0) >= LEARNED_BOX,
  ).length;
  return {
    learned,
    total: keys.length,
    needed: Math.ceil(keys.length * UNLOCK_SHARE - 1e-9),
  };
}

/** The end screen's level card: the level after the run and how the run moved it. */
export type LevelCard = {
  /** The level shown: the unlocked level if the run unlocked one, else the current level. */
  level: number;
  learned: number;
  total: number;
  /** Learned items needed to unlock the next level. */
  needed: number;
  /** Items still to learn for the unlock, never below 0. */
  toUnlock: number;
  /** Items this run newly learned on `level`; 0 when the run unlocked a level. */
  gained: number;
  /**
   * Characters this run newly learned (box crossed LEARNED_BOX) on the levels
   * from the one before the run up to `level`, in level order. On an unlock
   * these are the items that finished the old level.
   */
  learnedNow: string[];
  /** The level this run unlocked, else null. */
  unlocked: number | null;
  /** True on the last level: no next level, no unlock mark. */
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
): LevelCard {
  const level = after.unlockedLevel;
  const p = levelProgress(after, level, kana, kanji);
  const unlocked = level > before.unlockedLevel ? level : null;
  const gained =
    unlocked === null
      ? Math.max(
          0,
          p.learned - levelProgress(before, level, kana, kanji).learned,
        )
      : 0;
  const isLearned = (prog: Progress, key: string): boolean =>
    (prog.items[key]?.box ?? 0) >= LEARNED_BOX;
  const learnedNow: string[] = [];
  for (let l = Math.min(before.unlockedLevel, level); l <= level; l++)
    for (const i of levelItems(l, kana, kanji))
      if (isLearned(after, i.key) && !isLearned(before, i.key))
        learnedNow.push(i.char);
  return {
    level,
    ...p,
    toUnlock: Math.max(0, p.needed - p.learned),
    gained,
    learnedNow,
    unlocked,
    last: level >= maxLevel(kanji),
  };
}

/**
 * Progress with every level unlocked that the rule allows: while ≥ 80% of the
 * current level is learned, the next level unlocks. Never lowers the level.
 */
export function applyUnlock(
  progress: Progress,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): Progress {
  const top = maxLevel(kanji);
  let level = progress.unlockedLevel;
  for (;;) {
    if (level >= top) break;
    const p = levelProgress(progress, level, kana, kanji);
    if (p.total === 0 || p.learned < p.needed) break;
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
 * Answered items always keep their record. Words of those levels are marked
 * the same way (`words`); they never affect unlocking (`levelKeys`).
 */
export function place(
  progress: Progress,
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: readonly WordItem[] = [],
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
    for (const key of levelKeys(l, kana, kanji)) mark(key, l);
  for (const w of words) mark(itemKey(w.word, "word"), w.level);
  return {
    ...progress,
    unlockedLevel: n + 1,
    items: Object.fromEntries(
      Object.entries(items).filter(([key]) => !unplaced.has(key)),
    ),
  };
}

/** Meaning mode starts at Kanji 1; kana levels do not exist for it. */
export const MEANING_START_LEVEL = 2;

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
  return place(progress, Math.max(1, level), [], kanji);
}
