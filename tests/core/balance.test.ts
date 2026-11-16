import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { buildRun } from "../../src/core/run";
import type { RunState } from "../../src/core/sim";
import { defaultProgress, itemKey } from "../../src/core/srs";
import { WORDS } from "../../src/core/words";
import { botBossRun, botRun } from "./bot";
import { SLOW, forSeeds, itSlow } from "../sweep";
import { wkRun } from "./wk-run";

/** Died before answering the last question. */
const diedEarly = (s: RunState): boolean =>
  s.status === "dead" && s.results.length < s.rows.length;

const SEEDS = forSeeds(200, 10);

describe("balance bot (perfect steering)", () => {
  it("100% accuracy never dies before the last question", () => {
    const dead = SEEDS.filter((seed) =>
      diedEarly(botRun(seed, { wrong: () => false })),
    );
    expect(dead).toEqual([]);
  }, 60_000);

  it("50% accuracy dies before the last question in at least half the runs", () => {
    const dead = SEEDS.filter((seed) =>
      diedEarly(botRun(seed, { wrong: (q) => q % 2 === 1 })),
    );
    expect(dead.length).toBeGreaterThanOrEqual(SEEDS.length / 2);
  }, 60_000);
});

describe("balance bot with words in the pool (perfect steering)", () => {
  // all kana and the kanji of levels 2-8 learned: words are the new items
  const progress = { ...defaultProgress(), unlockedLevel: 8 };
  const known = { box: 2, seen: 1, correct: 1, wrong: 0, lastSeen: 1 };
  for (const k of KANA) progress.items[itemKey(k.char, "kana")] = known;
  for (const k of KANJI)
    if (k.level <= 8) progress.items[itemKey(k.char, "meaning")] = known;
  const build = (seed: number) => ({
    rows: buildRun(seed, progress, KANA, KANJI, WORDS),
  });

  it("100% accuracy never dies before the last question", () => {
    const runs = SEEDS.slice(0, 60).map((seed) =>
      botRun(seed, { build, wrong: () => false }),
    );
    expect(runs.filter(diedEarly)).toEqual([]);
    expect(runs.some((r) => r.rows.some((x) => x.type === "word"))).toBe(true);
  }, 60_000);
});

describe("balance bot with word readings in the pool (perfect steering)", () => {
  // as above, with the words themselves at box 3: their reading gates are asked
  const progress = { ...defaultProgress(), unlockedLevel: 8 };
  const known = { box: 2, seen: 1, correct: 1, wrong: 0, lastSeen: 1 };
  for (const k of KANA) progress.items[itemKey(k.char, "kana")] = known;
  for (const k of KANJI)
    if (k.level <= 8) progress.items[itemKey(k.char, "meaning")] = known;
  for (const w of WORDS)
    if (w.level <= 8)
      progress.items[itemKey(w.word, "word")] = { ...known, box: 3 };
  const build = (seed: number) => ({
    rows: buildRun(seed, progress, KANA, KANJI, WORDS),
  });

  it("100% accuracy never dies before the last question", () => {
    const runs = SEEDS.slice(0, 60).map((seed) =>
      botRun(seed, { build, wrong: () => false }),
    );
    expect(runs.filter(diedEarly)).toEqual([]);
    expect(runs.some((r) => r.rows.some((x) => x.type === "wordreading"))).toBe(
      true,
    );
  }, 60_000);
});

describe("balance bot in WaniKani mode, re-asks on (perfect steering)", () => {
  const wk = { build: (seed: number) => wkRun(seed) };

  it("100% accuracy never dies before the last question", () => {
    const runs = SEEDS.map((seed) =>
      botRun(seed, { ...wk, wrong: () => false }),
    );
    expect(SEEDS.filter((_, i) => diedEarly(runs[i] as RunState))).toEqual([]);
    // re-asks are actually placed
    expect(runs.some((s) => (s.reask?.links.length ?? 0) > 0)).toBe(true);
  }, 60_000);

  it("50% accuracy dies before the last question in at least half the runs", () => {
    const dead = SEEDS.filter((seed) =>
      diedEarly(botRun(seed, { ...wk, wrong: (q) => q % 2 === 1 })),
    );
    expect(dead.length).toBeGreaterThanOrEqual(SEEDS.length / 2);
  }, 60_000);
});

/** 200 seeds in the slow tier (20 in the fast one); `SLOW=1 BALANCE_RUNS=1000 npm test -- balance` runs the full 1,000. */
const BOSS_SEEDS = forSeeds(Number(process.env.BALANCE_RUNS) || 200, 10);
const RUNS = BOSS_SEEDS.length;
const winRate = (p: number, skill = 1): number =>
  BOSS_SEEDS.filter((seed) => botBossRun(seed, p, skill).won).length / RUNS;
const LONG = 600_000;

describe(`balance bot vs the boss (${RUNS} seeded runs)`, () => {
  it(
    "100% accuracy always wins",
    () => {
      expect(winRate(1)).toBe(1);
    },
    LONG,
  );

  // under 10% of 20 seeds is one run: too coarse
  itSlow(
    "50% accuracy wins less than 10% of the time",
    () => {
      expect(winRate(0.5)).toBeLessThan(0.1);
    },
    LONG,
  );

  // a 40-70% band is too narrow for 20 seeds
  itSlow(
    "80% accuracy wins 40–70% of the time",
    () => {
      const rate = winRate(0.8);
      expect(rate).toBeGreaterThanOrEqual(0.4);
      expect(rate).toBeLessThanOrEqual(0.7);
    },
    LONG,
  );

  it(
    "100% accuracy with steering skill 0.5 wins at least half the time",
    () => {
      expect(winRate(1, 0.5)).toBeGreaterThanOrEqual(0.5);
    },
    LONG,
  );

  it(
    "lower steering skill clips: skill 0.5 ends with fewer soldiers",
    () => {
      const total = (skill: number): number =>
        BOSS_SEEDS.slice(0, SLOW ? 50 : 10).reduce(
          (sum, seed) => sum + botBossRun(seed, 1, skill).run.army,
          0,
        );
      expect(total(0.5)).toBeLessThan(total(1));
    },
    LONG,
  );
});
