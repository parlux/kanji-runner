import { createRng, randInt, shuffle, type Rng } from "./rng";
import { ROWS_PER_RUN, TWO_OPTION_ROWS } from "./tuning";
import type { GateRow, KanaItem } from "./types";

/** Uniform kana-only run. Replaced by SRS-weighted selection in Task 7. */
export function buildKanaRun(
  seed: number,
  pool: readonly KanaItem[],
): GateRow[] {
  const rng = createRng(seed);
  const romaji = [...new Set(pool.map((k) => k.romaji))];
  return Array.from({ length: ROWS_PER_RUN }, (_, i) => {
    const item = pool[randInt(rng, pool.length)] as KanaItem;
    const count = i < TWO_OPTION_ROWS ? 2 : 3;
    return kanaRow(rng, item, romaji, count);
  });
}

function kanaRow(
  rng: Rng,
  item: KanaItem,
  romaji: string[],
  count: number,
): GateRow {
  const distractors = shuffle(
    rng,
    romaji.filter((r) => r !== item.romaji),
  ).slice(0, count - 1);
  const options = shuffle(rng, [item.romaji, ...distractors]);
  return {
    type: "kana",
    prompt: item.char,
    options,
    answerIndex: options.indexOf(item.romaji),
    answer: item.romaji,
  };
}
