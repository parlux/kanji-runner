import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { mainReadings, showReading } from "../../src/core/distractors";
import { createRng } from "../../src/core/rng";
import { buildRun, selectEntries, unlockedPool } from "../../src/core/run";
import { defaultProgress, itemKey } from "../../src/core/srs";
import { buildTrack, isCharge } from "../../src/core/track";
import { ROWS_PER_RUN, WARM_UPS } from "../../src/core/tuning";
import type { GateRow, Progress } from "../../src/core/types";

const rec = (box: number, seen = 1) => ({
  box,
  seen,
  correct: 0,
  wrong: 0,
  lastSeen: 1,
});

function withItems(boxes: Record<string, number>, unlockedLevel = 0): Progress {
  const p = { ...defaultProgress(), unlockedLevel };
  for (const [k, b] of Object.entries(boxes)) p.items[k] = rec(b);
  return p;
}

const keyOf = (r: GateRow) => itemKey(r.prompt, r.type);
const hira = KANA.filter((k) => k.script === "hiragana");

describe("buildRun selection", () => {
  it("a fresh player gets 14 rows from only the first 4 hiragana", () => {
    const rows = buildRun(1, defaultProgress(), KANA, KANJI);
    expect(rows).toHaveLength(ROWS_PER_RUN);
    expect(new Set(rows.map((r) => r.prompt))).toEqual(
      new Set(["あ", "い", "う", "え"]),
    );
  });

  it("never introduces more than 4 new items, taken in progression order", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed + 1000);
      // a random scattering of known items across hiragana and katakana
      const boxes: Record<string, number> = {};
      for (const k of KANA)
        if (rng() < 0.4) boxes[itemKey(k.char, "kana")] = Math.floor(rng() * 6);
      const p = withItems(boxes, 1);
      const rows = buildRun(seed, p, KANA, KANJI);
      expect(rows).toHaveLength(ROWS_PER_RUN);
      const fresh = new Set(rows.map(keyOf).filter((k) => !(k in p.items)));
      expect(fresh.size).toBeLessThanOrEqual(4);
      const firstNew = unlockedPool(p, KANA, KANJI)
        .filter((e) => !(e.key in p.items))
        .slice(0, 4)
        .map((e) => e.key);
      expect([...fresh].every((k) => firstNew.includes(k))).toBe(true);
    }
  });

  it("has no repeats once the pool is big enough", () => {
    const p = withItems(
      Object.fromEntries(hira.slice(0, 20).map((k) => [`${k.char}:kana`, 1])),
    );
    for (let seed = 0; seed < 50; seed++) {
      const keys = buildRun(seed, p, KANA, KANJI).map(keyOf);
      expect(new Set(keys).size).toBe(ROWS_PER_RUN);
    }
  });

  it("warm-ups are the highest-box known items and are wall gates", () => {
    const boxes: Record<string, number> = {};
    hira.slice(0, 30).forEach((k, i) => {
      boxes[`${k.char}:kana`] = i < 4 ? 5 : i % 4; // 4 items at box 5, rest ≤ 3
    });
    const p = withItems(boxes);
    for (let seed = 0; seed < 50; seed++) {
      const rows = buildRun(seed, p, KANA, KANJI);
      for (const r of rows.slice(0, WARM_UPS))
        expect(p.items[keyOf(r)]?.box).toBe(5);
      const track = buildTrack(seed, ROWS_PER_RUN);
      for (let q = 0; q < WARM_UPS; q++) expect(isCharge(track, q)).toBe(false);
    }
  });

  it("warm-ups are kana before kanji are unlocked, and can be kanji after", () => {
    const p = withItems(
      { "あ:kana": 1, "い:kana": 1, "う:kana": 1, "一:meaning": 5 },
      2,
    );
    const warm = buildRun(3, p, KANA, KANJI).slice(0, WARM_UPS).map(keyOf);
    expect(warm).toContain("一:meaning");
    const kanaOnly = buildRun(
      3,
      withItems({ "あ:kana": 5, "一:meaning": 5 }, 1),
      KANA,
      KANJI,
    );
    expect(kanaOnly.every((r) => r.type === "kana")).toBe(true);
  });

  it("reading gates unlock only once the meaning box is ≥ 3", () => {
    const lvl2 = KANJI.filter((k) => k.level === 2);
    // every kana known, so new items come from kanji
    const kana = Object.fromEntries(KANA.map((k) => [`${k.char}:kana`, 5]));
    const all = (box: number) =>
      withItems(
        {
          ...kana,
          ...Object.fromEntries(lvl2.map((k) => [`${k.char}:meaning`, box])),
        },
        2,
      );
    const types = (p: Progress) =>
      new Set(
        Array.from({ length: 30 }, (_, s) => buildRun(s, p, KANA, KANJI))
          .flat()
          .map((r) => r.type),
      );
    expect(types(all(2)).has("reading")).toBe(false);
    expect(types(all(3)).has("reading")).toBe(true);
  });

  it("a box-0 item comes up far more often than box-5 items", () => {
    const boxes = Object.fromEntries(hira.map((k) => [`${k.char}:kana`, 5]));
    boxes["ぬ:kana"] = 0;
    const p = withItems(boxes);
    const pool = unlockedPool(p, KANA, KANJI);
    const runs = 2000;
    const counts = new Map<string, number>();
    for (let s = 0; s < runs; s++)
      for (const e of new Set(selectEntries(createRng(s), pool, p)))
        counts.set(e.key, (counts.get(e.key) ?? 0) + 1);
    const missed = (counts.get("ぬ:kana") ?? 0) / runs;
    const others =
      [...counts]
        .filter(([k]) => k !== "ぬ:kana")
        .reduce((a, [, c]) => a + c, 0) /
      (hira.length - 1) /
      runs;
    expect(missed).toBeGreaterThan(0.9);
    expect(others).toBeLessThan(0.25);
  });

  it("rotates the shown reading by how often the reading was asked", () => {
    const k = KANJI.find((x) => x.on && x.kun && x.level === 2);
    if (!k) throw new Error("no kanji with both readings");
    const shown = (seen: number) => {
      const p = withItems({ [`${k.char}:meaning`]: 3 }, 2);
      p.items[`${k.char}:reading`] = rec(0, seen);
      // enough runs that the reading gets asked
      for (let s = 0; s < 200; s++) {
        const r = buildRun(s, p, KANA, KANJI).find(
          (x) => x.type === "reading" && x.prompt === k.char,
        );
        if (r) return r.answer;
      }
      throw new Error("never asked");
    };
    const [a, b] = mainReadings(k).map(showReading);
    expect(shown(0)).toBe(a);
    expect(shown(1)).toBe(b);
  });

  it("is identical for the same seed and progress, and options stay valid", () => {
    const p = withItems({ "あ:kana": 2, "一:meaning": 4 }, 3);
    expect(buildRun(9, p, KANA, KANJI)).toEqual(buildRun(9, p, KANA, KANJI));
    for (let s = 0; s < 100; s++)
      for (const r of buildRun(s, p, KANA, KANJI)) {
        expect(new Set(r.options).size).toBe(r.options.length);
        expect(r.options[r.answerIndex]).toBe(r.answer);
      }
  });
});
