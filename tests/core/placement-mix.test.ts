import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { place } from "../../src/core/progression";
import { createRng } from "../../src/core/rng";
import { buildRun } from "../../src/core/run";
import { defaultProgress, recordRun } from "../../src/core/srs";
import type { Progress } from "../../src/core/types";

const share = (progress: Progress, seeds = 200) => {
  let kanji = 0;
  let kana = 0;
  let runsWithKana = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const rows = buildRun(seed, progress, KANA, KANJI);
    const k = rows.filter((r) => r.type !== "kana").length;
    kanji += k;
    kana += rows.length - k;
    if (k < rows.length) runsWithKana++;
  }
  return {
    kanjiShare: kanji / (kanji + kana),
    runsWithKana: runsWithKana / seeds,
  };
};

/** Placed at Katakana, then runs at 80% accuracy until all of Kanji 1 is introduced. */
const introduced = (): Progress => {
  let p = place(defaultProgress(), 1, KANA, KANJI);
  const rng = createRng(99);
  const isNew = () =>
    KANJI.filter((k) => k.level === 2 && !p.items[`${k.char}:meaning`]);
  for (let i = 1; isNew().length > 0 && i < 100; i++) {
    const rows = buildRun(1000 + i, p, KANA, KANJI);
    p = recordRun(
      p,
      rows,
      rows.map(() => rng() < 0.8),
      true,
      i,
    );
  }
  return p;
};

describe("run mix after placing to Katakana", () => {
  it("first run: the 4 new kanji (the new-item cap) among placed kana", () => {
    const s = share(place(defaultProgress(), 1, KANA, KANJI));
    expect(s.kanjiShare).toBeCloseTo(4 / 14, 5);
    expect(s.runsWithKana).toBe(1);
  });

  it("after all 30 Kanji 1 are introduced: kanji are most of the run, kana still appear", () => {
    const s = share(introduced());
    expect(s.kanjiShare).toBeGreaterThan(0.6);
    expect(s.kanjiShare).toBeLessThan(0.9);
    expect(s.runsWithKana).toBeGreaterThan(0.5);
  });
});
