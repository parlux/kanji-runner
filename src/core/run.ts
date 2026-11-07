import { kanaRow } from "./distractors";
import { createRng, randInt } from "./rng";
import { ROWS_PER_RUN, TWO_OPTION_ROWS } from "./tuning";
import type { GateRow, KanaItem } from "./types";

/** Uniform kana-only run. Replaced by SRS-weighted selection in Task 7. */
export function buildKanaRun(
  seed: number,
  pool: readonly KanaItem[],
): GateRow[] {
  const rng = createRng(seed);
  return Array.from({ length: ROWS_PER_RUN }, (_, i) => {
    const item = pool[randInt(rng, pool.length)] as KanaItem;
    const count = i < TWO_OPTION_ROWS ? 2 : 3;
    return kanaRow(rng, item, pool, count);
  });
}
