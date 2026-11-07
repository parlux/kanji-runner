import { describe, expect, it } from "vitest";
import {
  meaningRow,
  normGloss,
  plainReading,
  readingRow,
  showReading,
  shownReading,
} from "../../src/core/distractors";
import { createRng } from "../../src/core/rng";
import type { GateRow, KanjiItem } from "../../src/core/types";
import { syntheticList } from "./wk-fixture";

const list = syntheticList();
const byChar = new Map(list.kanji.map((k) => [k.char, k]));
const similarOf = (k: KanjiItem): string[] =>
  list.extras.get(k.char)?.similar ?? [];
const wrong = (r: GateRow): string[] =>
  r.options.filter((_, i) => i !== r.answerIndex);

/** The similar kanji that are valid meaning distractors for `k`. */
const validSimilarGlosses = (k: KanjiItem): string[] => {
  const own = new Set(k.glosses.map(normGloss));
  return similarOf(k)
    .map((c) => byChar.get(c) as KanjiItem)
    .filter((s) => !s.glosses.some((g) => own.has(normGloss(g))))
    .map((s) => s.glosses[0] as string);
};

describe("WaniKani distractors (synthetic list)", () => {
  it("meaning: v1 validity holds and similar kanji come first (property)", () => {
    const problems: string[] = [];
    for (let seed = 0; seed < 40; seed++)
      for (const k of list.kanji)
        for (const count of [2, 3]) {
          const r = meaningRow(
            createRng(seed),
            k,
            list.kanji,
            count,
            similarOf(k),
          );
          const keys = r.options.map(normGloss);
          if (r.options.length !== count || new Set(keys).size !== count)
            problems.push(`${k.char}: ${r.options.join(" / ")}`);
          if (
            r.options[r.answerIndex] !== r.answer ||
            r.answer !== k.glosses[0]
          )
            problems.push(`${k.char}: answer`);
          const own = new Set(k.glosses.map(normGloss));
          for (const o of wrong(r)) {
            if (own.has(normGloss(o))) problems.push(`${k.char}: ${o}`);
            const src = list.kanji.find((x) => x.glosses[0] === o);
            if (src?.glosses.some((g) => own.has(normGloss(g))))
              problems.push(`${k.char}: overlapping ${o}`);
          }
          const sim = validSimilarGlosses(k);
          const firstN = Math.min(sim.length, count - 1);
          const usedSim = wrong(r).filter((o) => sim.includes(o)).length;
          if (usedSim !== firstN)
            problems.push(`${k.char}: ${usedSim} similar of ${firstN}`);
        }
    expect(problems).toEqual([]);
  });

  it("an overlapping-gloss similar kanji is still excluded", () => {
    const k = list.kanji[5] as KanjiItem; // list.kanji[6] shares "thing 5"
    const overlap = list.kanji[6] as KanjiItem;
    expect(similarOf(k)).toContain(overlap.char);
    for (let seed = 0; seed < 50; seed++) {
      const r = meaningRow(createRng(seed), k, list.kanji, 3, similarOf(k));
      expect(wrong(r)).not.toContain(overlap.glosses[0]);
    }
  });

  it("reading: v1 validity holds and similar kanji come first (property)", () => {
    const problems: string[] = [];
    for (let seed = 0; seed < 40; seed++)
      for (const k of list.kanji) {
        const shown = shownReading(k, seed);
        const sim = similarOf(k);
        const r = readingRow(createRng(seed), k, list.kanji, 2, shown, sim);
        if (
          r.options.length !== 2 ||
          new Set(r.options.map(plainReading)).size !== 2
        )
          problems.push(`${k.char}: ${r.options.join(" / ")}`);
        if (
          r.answer !== showReading(shown) ||
          r.options[r.answerIndex] !== r.answer
        )
          problems.push(`${k.char}: answer`);
        const len = plainReading(r.answer).length;
        for (const o of wrong(r)) {
          if (k.readings.includes(plainReading(o)))
            problems.push(`${k.char}: own reading ${o}`);
          if (Math.abs(plainReading(o).length - len) > 1)
            problems.push(`${k.char}: ${o} length`);
        }
        // a similar kanji's main reading, when one qualifies, is chosen
        const own = new Set([...k.readings, plainReading(r.answer)]);
        const simReadings = sim
          .flatMap((c) => {
            const s = byChar.get(c) as KanjiItem;
            return [s.on as string, `${s.kun?.base}(${s.kun?.okurigana})`];
          })
          .filter(
            (o) =>
              !own.has(plainReading(o)) &&
              Math.abs(plainReading(o).length - len) <= 1,
          );
        if (
          simReadings.length > 0 &&
          !simReadings.includes(wrong(r)[0] as string)
        )
          problems.push(`${k.char}: ${wrong(r)[0]} is not similar`);
      }
    expect(problems).toEqual([]);
  });
});
