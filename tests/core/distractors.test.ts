import { describe, expect, it } from "vitest";
import {
  kanaRow,
  mainReadings,
  meaningRow,
  normGloss,
  plainReading,
  readingRow,
  showReading,
  shownReading,
} from "../../src/core/distractors";
import { KANA } from "../../src/core/kana";
import { createRng } from "../../src/core/rng";
import type { GateRow, KanjiItem } from "../../src/core/types";
import kanjiData from "../../src/data/kanji.json";

const KANJI = kanjiData as KanjiItem[];
const byChar = new Map(KANJI.map((k) => [k.char, k]));
const kanji = (c: string): KanjiItem => byChar.get(c) as KanjiItem;
const pools = new Map<number, KanjiItem[]>();
/** Unlocked levels up to the item's own, plus the next one. */
function poolFor(k: KanjiItem): KanjiItem[] {
  let p = pools.get(k.level);
  if (!p) pools.set(k.level, (p = KANJI.filter((x) => x.level <= k.level + 1)));
  return p;
}

/** Every kanji with 2 seeds, then every 20th kanji with 40 more seeds. */
function* cases(): Generator<[KanjiItem, number]> {
  for (let seed = 0; seed < 2; seed++) for (const k of KANJI) yield [k, seed];
  for (let seed = 2; seed < 42; seed++)
    for (let i = seed % 20; i < KANJI.length; i += 20)
      yield [KANJI[i] as KanjiItem, seed];
}

/** Problems with a row's shape: option count, duplicates (by `key`), answer index. */
function malformed(
  r: GateRow,
  count: number,
  key: (o: string) => string,
): string[] {
  const out: string[] = [];
  if (r.options.length !== count)
    out.push(`${r.prompt}: ${r.options.length} options`);
  if (new Set(r.options.map(key)).size !== r.options.length)
    out.push(`${r.prompt}: duplicate in ${r.options.join(" / ")}`);
  if (r.options[r.answerIndex] !== r.answer)
    out.push(`${r.prompt}: answer index`);
  return out;
}

function expectWellFormed(r: GateRow, count: number): void {
  expect(r.options).toHaveLength(count);
  expect(new Set(r.options).size).toBe(count);
  expect(r.options[r.answerIndex]).toBe(r.answer);
}

const wrong = (r: GateRow): string[] =>
  r.options.filter((_, i) => i !== r.answerIndex);

describe("kana distractors", () => {
  it("never repeat or include the answer's romaji (many seeds)", () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      for (const k of KANA) {
        const r = kanaRow(rng, k, KANA, 3);
        expectWellFormed(r, 3);
        expect(wrong(r)).not.toContain(k.romaji);
      }
    }
  });

  it("prefer a look-alike kana over a random one", () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = kanaRow(
        createRng(seed),
        { char: "シ", romaji: "shi", script: "katakana" },
        KANA,
        2,
      );
      expect(r.options).toEqual(expect.arrayContaining(["shi", "tsu"]));
    }
  });
});

describe("meaning distractors", () => {
  it("are never a gloss of the prompt and never repeat (property)", () => {
    const problems: string[] = [];
    for (const [k, seed] of cases()) {
      const r = meaningRow(createRng(seed), k, poolFor(k), 3);
      problems.push(...malformed(r, 3, normGloss));
      if (r.answer !== k.glosses[0]) problems.push(`${k.char}: ${r.answer}`);
      const own = new Set(k.glosses.map(normGloss));
      for (const o of wrong(r))
        if (own.has(normGloss(o))) problems.push(`${k.char}: ${o}`);
    }
    expect(problems).toEqual([]);
  }, 60_000);

  it("exclude a kanji with any overlapping gloss", () => {
    // 大 "large, big": no other option may be a kanji that also means "big"
    const big = KANJI.filter((k) =>
      k.glosses.some((g) => normGloss(g) === "big"),
    );
    expect(big.length).toBeGreaterThan(1);
    const labels = new Set(big.map((k) => k.glosses[0]));
    for (let seed = 0; seed < 200; seed++) {
      const r = meaningRow(createRng(seed), kanji("大"), big, 2);
      expect(r.options).toHaveLength(1); // nothing valid left to add
      expect(wrong(r).some((o) => labels.has(o))).toBe(false);
    }
  });

  it("prefer a kanji sharing a component over a random one", () => {
    // 休 and 体 share ⺅; 山 and 川 share nothing with 休
    const pool = [kanji("休"), kanji("体"), kanji("山"), kanji("川")];
    for (let seed = 0; seed < 50; seed++) {
      const r = meaningRow(createRng(seed), kanji("休"), pool, 2);
      expect(wrong(r)).toEqual([kanji("体").glosses[0]]);
    }
  });
});

describe("readings", () => {
  it("show kun'yomi okurigana in brackets, and nothing for an empty one", () => {
    expect(showReading({ base: "あ", okurigana: "げる" })).toBe("あ(げる)");
    expect(showReading({ base: "ひと", okurigana: "" })).toBe("ひと");
    expect(plainReading("あ(げる)")).toBe("あげる");
  });

  it("rotate between the main on'yomi and kun'yomi", () => {
    const k = kanji("休");
    expect(mainReadings(k).map(showReading)).toEqual(["きゅう", "やす(む)"]);
    expect(showReading(shownReading(k, 0))).toBe("きゅう");
    expect(showReading(shownReading(k, 1))).toBe("やす(む)");
    expect(showReading(shownReading(k, 2))).toBe("きゅう");
    const onOnly = KANJI.find((x) => !x.kun) as KanjiItem;
    expect(shownReading(onOnly, 1)).toEqual(shownReading(onOnly, 0));
  });
});

describe("reading distractors", () => {
  it("are never any reading of the prompt, never repeat, and keep within ±1 kana (property)", () => {
    const problems: string[] = [];
    for (const [k, seed] of cases()) {
      const shown = shownReading(k, seed);
      const r = readingRow(createRng(seed), k, poolFor(k), 3, shown);
      problems.push(...malformed(r, 3, plainReading));
      if (r.answer !== showReading(shown))
        problems.push(`${k.char}: ${r.answer}`);
      const len = plainReading(r.answer).length;
      for (const o of wrong(r)) {
        if (k.readings.includes(plainReading(o)))
          problems.push(`${k.char}: ${o}`);
        if (Math.abs(plainReading(o).length - len) > 1)
          problems.push(`${k.char}: ${o} is not within ±1 of ${r.answer}`);
      }
    }
    expect(problems).toEqual([]);
  }, 60_000);

  it("prefer a kanji sharing a component over a random one", () => {
    // 休 (きゅう) and 体 (たい) share ⺅; 山 and 川 share nothing with 休
    const pool = [kanji("休"), kanji("体"), kanji("山"), kanji("川")];
    const fromBody = mainReadings(kanji("体")).map(showReading);
    for (let seed = 0; seed < 50; seed++) {
      const r = readingRow(
        createRng(seed),
        kanji("休"),
        pool,
        2,
        shownReading(kanji("休"), 0),
      );
      expect(fromBody).toContain(wrong(r)[0]);
    }
  });

  it("keep to within ±1 kana of the shown reading", () => {
    // 休 shown as きゅう (3 kana)
    for (let seed = 0; seed < 50; seed++) {
      const r = readingRow(
        createRng(seed),
        kanji("休"),
        poolFor(kanji("休")),
        3,
        shownReading(kanji("休"), 0),
      );
      for (const o of wrong(r))
        expect(Math.abs(plainReading(o).length - 3)).toBeLessThanOrEqual(1);
    }
  });
});
