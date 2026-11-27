import {
  groupName,
  groupOf,
  levelName,
  type LevelProgress,
} from "../core/progression";

/** "4 more to unlock Kanji 10", "Kanji 10 unlocks next run" or "Last level". */
export function unlockLine(
  level: number,
  toUnlock: number,
  last: boolean,
): string {
  if (last) return "Last level";
  const next = levelName(level + 1);
  return toUnlock > 0
    ? `${toUnlock} more to unlock ${next}`
    : `${next} unlocks next run`;
}

/** "Foundations · Kanji 9": the group name before the level's name. */
export const groupedLevelName = (level: number): string =>
  `${groupName(groupOf(level))} · ${levelName(level)}`;

/**
 * "Kanji 5/7 · words 6/8", plus " · 3 need their reading" ("1 needs its
 * reading") when some are waiting on it. Null when the level has no words
 * (kana levels, meaning mode): there is nothing to split.
 */
export function kindLine(p: LevelProgress): string | null {
  if (p.words.total === 0) return null;
  const base = `Kanji ${p.kanji.learned}/${p.kanji.total} · words ${p.words.learned}/${p.words.total}`;
  if (p.readingToGo === 0) return base;
  return `${base} · ${
    p.readingToGo === 1
      ? "1 needs its reading"
      : `${p.readingToGo} need their reading`
  }`;
}
