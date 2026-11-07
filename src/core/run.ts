import { kanaRow, meaningRow, readingRow, shownReading } from "./distractors";
import { createRng, randInt, shuffle } from "./rng";
import { ROWS_PER_RUN, TWO_OPTION_ROWS } from "./tuning";
import type { GateRow, KanaItem, KanjiItem } from "./types";

const optionCount = (i: number): number => (i < TWO_OPTION_ROWS ? 2 : 3);

/** Uniform kana-only run. Replaced by SRS-weighted selection in Task 7. */
export function buildKanaRun(
  seed: number,
  pool: readonly KanaItem[],
): GateRow[] {
  const rng = createRng(seed);
  return Array.from({ length: ROWS_PER_RUN }, (_, i) => {
    const item = pool[randInt(rng, pool.length)] as KanaItem;
    return kanaRow(rng, item, pool, optionCount(i));
  });
}

/**
 * Uniform kanji run with levels 2..`level` unlocked: each question asks a
 * random unlocked kanji (no repeats while there are enough), as a meaning or
 * a reading gate at random. Distractors also draw on the next level. The
 * reading shown rotates with the seed. A dev stand-in until Task 7's SRS.
 */
export function buildKanjiRun(
  seed: number,
  kanji: readonly KanjiItem[],
  level: number,
): GateRow[] {
  const rng = createRng(seed);
  const unlocked = kanji.filter((k) => k.level <= level);
  const pool = kanji.filter((k) => k.level <= level + 1);
  const picks = shuffle(rng, unlocked);
  return Array.from({ length: ROWS_PER_RUN }, (_, i) => {
    const item = picks[i % picks.length] as KanjiItem;
    const count = optionCount(i);
    return rng() < 0.5
      ? meaningRow(rng, item, pool, count)
      : readingRow(rng, item, pool, count, shownReading(item, seed));
  });
}
