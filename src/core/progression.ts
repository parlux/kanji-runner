import { kanaLevel } from "./run";
import { itemKey } from "./srs";
import type { KanaItem, KanjiItem, Progress } from "./types";

/** An item counts as learned for unlocking at this box or higher. */
export const LEARNED_BOX = 2;
/** The next level unlocks when this share of the current level is learned. */
export const UNLOCK_SHARE = 0.8;

/** Human level names: Hiragana, Katakana, then Kanji 1, Kanji 2, … */
export const levelName = (level: number): string =>
  level === 0 ? "Hiragana" : level === 1 ? "Katakana" : `Kanji ${level - 1}`;

/** The highest level with any items (the last kanji level). */
export const maxLevel = (kanji: readonly KanjiItem[]): number =>
  kanji.reduce((m, k) => Math.max(m, k.level), 1);

/** Item keys of a level for its primary gate type: kana, or kanji meaning. */
export function levelKeys(
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): string[] {
  if (level < 2)
    return kana
      .filter((k) => kanaLevel(k) === level)
      .map((k) => itemKey(k.char, "kana"));
  return kanji
    .filter((k) => k.level === level)
    .map((k) => itemKey(k.char, "meaning"));
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
 * raised to box 2 (never lowered) and level N + 1 is unlocked. Re-picking
 * lower undoes an over-placement: the unlocked level becomes N + 1, and
 * placement marks above N that were never answered (seen 0) are removed.
 * Answered items always keep their record.
 */
export function place(
  progress: Progress,
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): Progress {
  const top = maxLevel(kanji);
  const n = Math.max(-1, Math.min(level, top - 1));
  const items = { ...progress.items };
  const unplaced = new Set<string>();
  for (let l = 0; l <= top; l++)
    for (const key of levelKeys(l, kana, kanji)) {
      const item = items[key];
      if (l <= n) {
        if (!item)
          items[key] = {
            box: LEARNED_BOX,
            seen: 0,
            correct: 0,
            wrong: 0,
            lastSeen: 0,
          };
        else if (item.box < LEARNED_BOX)
          items[key] = { ...item, box: LEARNED_BOX };
      } else if (item?.seen === 0) unplaced.add(key);
    }
  return {
    ...progress,
    unlockedLevel: n + 1,
    items: Object.fromEntries(
      Object.entries(items).filter(([key]) => !unplaced.has(key)),
    ),
  };
}
