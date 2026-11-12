import { describe, expect, it } from "vitest";
import {
  meaningRow,
  normGloss,
  plainReading,
  readingRow,
  showReading,
  shownReading,
} from "../../src/core/distractors";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { WORDS, kanaNeeded } from "../../src/core/words";
import {
  seededBox,
  builtInPool,
  unlockedPool,
  wanikaniPool,
  type Entry,
  type WkPoolInput,
} from "../../src/core/pool";
import { createRng } from "../../src/core/rng";
import { buildPoolRun, buildRun, select } from "../../src/core/run";
import { defaultProgress, itemKey, MAX_BOX } from "../../src/core/srs";
import { MAX_NEW_PER_RUN, ROWS_PER_RUN } from "../../src/core/tuning";
import type { GateRow, KanjiItem, Progress } from "../../src/core/types";
import type { WkList } from "../../src/wanikani/parse";
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

// A parsed WaniKani list is a valid pool input (compile-time check).
const asInput = (l: WkList): WkPoolInput => l;
void asInput;

const rec = (box: number) => ({
  box,
  seen: 1,
  correct: 1,
  wrong: 0,
  lastSeen: 1,
});

/** All kana known at box 5, so WaniKani runs can be about kanji. */
function kanaDone(): Progress {
  const p = { ...defaultProgress(), unlockedLevel: 2 };
  for (const k of KANA) p.items[itemKey(k.char, "kana")] = rec(MAX_BOX);
  return p;
}

/** A synthetic list with every kanji at one stage, due or not. */
function uniform(
  n: number,
  stage: number,
  due: (i: number) => boolean,
): WkPoolInput {
  const base = syntheticList(n);
  return {
    kanji: base.kanji,
    extras: new Map(
      base.kanji.map((k, i) => [
        k.char,
        { srsStage: stage, due: due(i), similar: [] },
      ]),
    ),
  };
}

const keys = (es: readonly Entry[]) => es.map((e) => e.key);

describe("WaniKani pool", () => {
  it("seeds a box from the WaniKani stage", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(seededBox)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 5, 5,
    ]);
  });

  it("uses the seeded box without a record, and a real record over it", () => {
    const one = uniform(2, 7, () => false); // seeded box 4
    const [a, b] = one.kanji as [KanjiItem, KanjiItem];
    const p = kanaDone();
    p.items[itemKey(b.char, "meaning")] = rec(1);
    const pool = wanikaniPool(p, KANA, one);
    const find = (key: string) =>
      pool.entries.find((e) => e.key === key) as Entry;
    const ma = find(itemKey(a.char, "meaning"));
    const mb = find(itemKey(b.char, "meaning"));
    expect(pool.box(ma)).toBe(4);
    expect(pool.box(mb)).toBe(1);
    expect(pool.known(ma)).toBe(true);
    expect(pool.weight(ma)).toBe(2);
    expect(pool.weight(mb)).toBe(16);
    // the seeded box is never written
    expect(p.items[itemKey(a.char, "meaning")]).toBeUndefined();
  });

  it("gates readings on the meaning box, seeded or real", () => {
    const base = syntheticList(4);
    const [a, b, c, d] = base.kanji as KanjiItem[] as [
      KanjiItem,
      KanjiItem,
      KanjiItem,
      KanjiItem,
    ];
    const stages = new Map([
      [a.char, 5], // seeded 3: reading
      [b.char, 4], // seeded 2: no reading
      [c.char, 4], // seeded 2, but a real box 3: reading
      [d.char, 9], // seeded 5, but a real box 0: no reading
    ]);
    const list: WkPoolInput = {
      kanji: base.kanji,
      extras: new Map(
        base.kanji.map((k) => [
          k.char,
          { srsStage: stages.get(k.char) as number, due: false, similar: [] },
        ]),
      ),
    };
    const p = kanaDone();
    p.items[itemKey(c.char, "meaning")] = rec(3);
    p.items[itemKey(d.char, "meaning")] = rec(0);
    const readings = keys(wanikaniPool(p, KANA, list).entries).filter((k) =>
      k.endsWith(":reading"),
    );
    expect(readings).toEqual([
      itemKey(a.char, "reading"),
      itemKey(c.char, "reading"),
    ]);
  });

  it("a seeded reading gate has the seeded box too, until answered", () => {
    const list = uniform(1, 8, () => false);
    const k = list.kanji[0] as KanjiItem;
    const pool = wanikaniPool(kanaDone(), KANA, list);
    const r = pool.entries.find((e) => e.type === "reading") as Entry;
    expect(r.key).toBe(itemKey(k.char, "reading"));
    expect(pool.box(r)).toBe(5);
  });

  it("asks only taught kanji, with no new-items cap", () => {
    const list = uniform(40, 1, () => false);
    const taught = new Set(list.kanji.map((k) => k.char));
    for (let seed = 0; seed < 50; seed++) {
      const rows = buildPoolRun(
        seed,
        kanaDone(),
        wanikaniPool(kanaDone(), KANA, list),
      );
      expect(rows).toHaveLength(ROWS_PER_RUN);
      const kanji = rows.filter((r) => r.type !== "kana");
      for (const r of kanji) expect(taught.has(r.prompt)).toBe(true);
      // none has a record, yet far more than 4 kanji are asked
      expect(new Set(kanji.map((r) => r.prompt)).size).toBeGreaterThan(
        MAX_NEW_PER_RUN,
      );
    }
  });

  it("keeps the v1 cap for new kana", () => {
    const list = uniform(20, 3, () => false);
    for (let seed = 0; seed < 50; seed++) {
      const rows = buildPoolRun(
        seed,
        defaultProgress(),
        wanikaniPool(defaultProgress(), KANA, list),
      );
      const kana = new Set(
        rows.filter((r) => r.type === "kana").map((r) => r.prompt),
      );
      expect(kana.size).toBeLessThanOrEqual(MAX_NEW_PER_RUN);
      expect([...kana].every((c) => "あいうえ".includes(c))).toBe(true);
    }
  });

  it("warm-ups are the highest-box known items", () => {
    const base = syntheticList(30);
    const list: WkPoolInput = {
      kanji: base.kanji,
      extras: new Map(
        base.kanji.map((k, i) => [
          k.char,
          { srsStage: i < 3 ? 9 : 1, due: false, similar: [] },
        ]),
      ),
    };
    const top = new Set(base.kanji.slice(0, 3).map((k) => k.char));
    for (let seed = 0; seed < 20; seed++) {
      const rows = buildPoolRun(
        seed,
        kanaDone(),
        wanikaniPool(kanaDone(), KANA, list),
      );
      // box 5: the 3 seeded-9 kanji's meanings and readings, or a box-5 kana
      for (const r of rows.slice(0, 3))
        expect(r.type === "kana" || top.has(r.prompt)).toBe(true);
    }
  });

  it("picks due kanji more often than non-due kanji with the same box (1,000 seeds)", () => {
    const list = uniform(40, 3, (i) => i % 2 === 0); // all seeded box 2
    const p = kanaDone();
    const pool = wanikaniPool(p, KANA, list);
    const due = new Set(
      list.kanji.filter((_, i) => i % 2 === 0).map((k) => k.char),
    );
    let dueN = 0;
    let otherN = 0;
    for (let seed = 0; seed < 1000; seed++)
      for (const e of select(createRng(seed), pool))
        if (e.type !== "kana" && e.type !== "word") {
          if (due.has(e.item.char)) dueN++;
          else otherN++;
        }
    // the same number of due and non-due kanji: the ratio is the pick-rate ratio
    expect(dueN / otherN).toBeGreaterThan(2);
  });
});

describe("words in the Built-in pool", () => {
  const learnedKana = (p: Progress, box = 2): Progress => {
    for (const k of KANA) p.items[itemKey(k.char, "kana")] = rec(box);
    return p;
  };
  const rec = (box: number) => ({
    box,
    seen: 1,
    correct: 1,
    wrong: 0,
    lastSeen: 1,
  });
  const at = (level: number): Progress =>
    learnedKana({ ...defaultProgress(), unlockedLevel: level });

  it("has no word before its level or with an unlearned kana", () => {
    for (const level of [0, 1, 2, 5, 20]) {
      const p = at(level);
      const wordsIn = unlockedPool(p, KANA, KANJI, WORDS).filter(
        (e) => e.type === "word",
      );
      for (const e of wordsIn) expect(e.item.level).toBeLessThanOrEqual(level);
    }
    const p = at(5);
    p.items[itemKey("コ", "kana")] = rec(1);
    for (const e of unlockedPool(p, KANA, KANJI, WORDS))
      if (e.type === "word")
        expect(kanaNeeded(e.item.word)).not.toContain("コ");
  });

  it("lists words after the kanji, in list order, none when not given", () => {
    const p = at(6);
    const pool = unlockedPool(p, KANA, KANJI, WORDS);
    const firstWord = pool.findIndex((e) => e.type === "word");
    expect(firstWord).toBeGreaterThan(0);
    expect(pool.slice(firstWord).every((e) => e.type === "word")).toBe(true);
    expect(unlockedPool(p, KANA, KANJI).some((e) => e.type === "word")).toBe(
      false,
    );
  });

  it("introduces at most 1 new word per run, inside the cap of 4", () => {
    // every kanji known, no word known: only new words are left to introduce
    const p = at(6);
    for (const k of KANJI)
      if (k.level <= 6) p.items[itemKey(k.char, "meaning")] = rec(2);
    const pool = builtInPool(p, KANA, KANJI, WORDS);
    expect(
      pool.entries.filter((e) => e.type === "word").length,
    ).toBeGreaterThan(1);
    for (let seed = 0; seed < 300; seed++) {
      const run = select(createRng(seed), pool);
      const fresh = run.filter((e) => !pool.known(e));
      expect(fresh.filter((e) => e.type === "word").length).toBeLessThanOrEqual(
        1,
      );
      expect(fresh.length).toBeLessThanOrEqual(MAX_NEW_PER_RUN);
    }
  });

  it("runs with no eligible words are identical with or without the list", () => {
    const p = { ...defaultProgress(), unlockedLevel: 3 }; // katakana unlearned
    for (let seed = 0; seed < 20; seed++)
      expect(buildRun(seed, p, KANA, KANJI, WORDS)).toEqual(
        buildRun(seed, p, KANA, KANJI),
      );
  });

  it("builds word rows asking the first gloss", () => {
    const p = at(8);
    for (const k of KANJI)
      if (k.level <= 8) p.items[itemKey(k.char, "meaning")] = rec(2);
    const rows = [];
    for (let seed = 0; seed < 50; seed++)
      rows.push(...buildRun(seed, p, KANA, KANJI, WORDS));
    const w = rows.filter((r) => r.type === "word");
    expect(w.length).toBeGreaterThan(0);
    for (const r of w) {
      const item = WORDS.find((x) => x.word === r.prompt);
      expect(item?.glosses[0]).toBe(r.answer);
    }
  });
});
