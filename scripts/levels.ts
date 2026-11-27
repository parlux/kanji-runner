/**
 * Levels of 15 new things (SPEC-overall-progress §2). Pure: `build-data.ts`
 * calls it after the word picker.
 *
 * Teaching order is one line: each kanji in order, then the words whose
 * last-taught kanji it is (in their given order; `々` adds none). Level 2 on
 * takes the next items from that line: 14 while loanwords remain (loanword i
 * joins level 2 + i), else 15. The last level takes what is left.
 */

/** Items a kanji level holds, counting its loanword. */
export const LEVEL_ITEMS = 15;

export type Sliced = {
  /** Level of each kanji, by index. */
  kanji: number[];
  /** Level of each word, by index. */
  words: number[];
  /** Word indices in line order (how `words.json` is written). */
  wordOrder: number[];
};

export function sliceLevels(
  kanji: readonly string[],
  words: readonly string[],
  loanwordCount: number,
): Sliced {
  const pos = new Map(kanji.map((c, i) => [c, i]));
  const after: number[][] = kanji.map(() => []);
  words.forEach((w, i) => {
    const last = Math.max(...[...w].map((c) => pos.get(c) ?? -1));
    if (last < 0) throw new Error(`word ${w}: none of its kanji are taught`);
    after[last]?.push(i);
  });
  const line = kanji.flatMap((_, k) => [
    { kanji: k },
    ...(after[k] ?? []).map((w) => ({ word: w })),
  ]);
  const out: Sliced = {
    kanji: kanji.map(() => 0),
    words: words.map(() => 0),
    wordOrder: line.flatMap((x) => ("word" in x ? [x.word] : [])),
  };
  let level = 1;
  let room = 0;
  for (const item of line) {
    if (room === 0) {
      level += 1;
      room = LEVEL_ITEMS - (level - 2 < loanwordCount ? 1 : 0);
    }
    if ("kanji" in item) out.kanji[item.kanji] = level;
    else out.words[item.word] = level;
    room -= 1;
  }
  return out;
}
