import { describe, expect, it } from "vitest";
import {
  byGrade,
  orderReport,
  usefulOrder,
  type RaceWord,
} from "../../scripts/order";
import type { RawKanji } from "../../scripts/sources";

/** A made-up kanji: grade sets the `byGrade` tail, strokes the cost. */
const k = (char: string, strokes: number, grade = 1): RawKanji => ({
  char,
  grade,
  freq: null,
  strokes,
  on: [],
  kun: [],
  meanings: [],
});
const w = (word: string, value: number, theme = false): RaceWord => ({
  word,
  value,
  theme,
});

// 寸 is a block of 寺, 寺 and 日 are blocks of 時 (recursive).
const RAW = [
  k("一", 1),
  k("日", 4),
  k("寸", 3, 6),
  k("寺", 6, 2),
  k("時", 10, 2),
  k("間", 12, 2),
  k("駅", 14, 3),
  k("干", 3, 6),
  k("番", 12, 2),
];
const COMPONENTS = new Map([
  ["寺", ["寸", "土"]],
  ["時", ["日", "寺"]],
  ["間", ["日", "門"]],
]);
const order = (words: RaceWord[], overrides = []) =>
  usefulOrder(RAW, COMPONENTS, words, overrides);

describe("usefulOrder", () => {
  it("costs a word with its unplaced building blocks, recursively", () => {
    // 時 alone costs 時 2.0 + 日 1.4 + 寺 1.6 + 寸 1.3 = 6.3; 駅 costs 2.4.
    // 時 value 6.2 (ratio 0.98) loses to 駅 value 2.4 (ratio 1.0).
    expect(order([w("時", 6.2), w("駅", 2.4)]).order.slice(0, 1)).toEqual([
      "駅",
    ]);
    expect(order([w("時", 6.4), w("駅", 2.4)]).order[0]).toBe("日");
  });

  it("places building blocks first, by byGrade rank", () => {
    const { order: o, why } = order([w("時", 1)]);
    expect(o.slice(0, 4)).toEqual(["日", "寸", "寺", "時"]);
    expect(why.get("寸")).toMatchObject({ kind: "block", of: "時" });
    expect(why.get("時")).toMatchObject({ kind: "word" });
  });

  it("lowers a word's cost once its kanji are placed, and drops free words", () => {
    // After 日 (ratio 1/1.4), 日間 costs only 間 (2.2): 0.7/2.2 > 0.1/2.4.
    const { order: o, why } = order([
      w("日", 1),
      w("日間", 0.7),
      w("駅", 0.1),
      w("一日", 0.01),
    ]);
    expect(o.slice(0, 4)).toEqual(["日", "間", "駅", "一"]);
    expect(why.get("間")).toMatchObject({ word: { word: "日間" } });
  });

  it("breaks ties by value, then spelling", () => {
    // Same ratio: higher value first; same value: spelling.
    // 一 costs 1.1, 番 2.2: same ratio, 番 has the higher value.
    expect(order([w("一", 0.5), w("番", 1)]).order[0]).toBe("番");
    const tie = [w("寸", 1), w("干", 1)];
    expect(order(tie).order[0]).toBe("寸");
    expect(order([...tie].reverse()).order).toEqual(order(tie).order);
  });

  it("ignores words of value 0 and puts leftovers in byGrade order", () => {
    const { order: o, why } = order([w("駅", 1), w("干", 0)]);
    const tail = byGrade(RAW, COMPONENTS, []).filter((c) => c !== "駅");
    expect(o).toEqual(["駅", ...tail]);
    expect(why.get("干")).toEqual({ kind: "leftover" });
  });

  it("holds every kanji once", () => {
    const { order: o } = order([w("時間", 3), w("一日", 1)]);
    expect([...o].sort()).toEqual(RAW.map((x) => x.char).sort());
  });

  it("still applies the order overrides", () => {
    const o = usefulOrder(
      RAW,
      COMPONENTS,
      [w("駅", 1)],
      [{ char: "干", before: "駅" }],
    ).order;
    expect(o.slice(0, 2)).toEqual(["干", "駅"]);
    expect(() =>
      usefulOrder(RAW, COMPONENTS, [], [{ char: "x", after: "駅" }]),
    ).toThrow(/bad order override/);
  });
});

describe("orderReport", () => {
  it("summarizes and lists why per level", () => {
    const { order: o, why } = order([w("時", 1, true), w("駅", 0.01)]);
    const text = orderReport(o, why, (i) => 2 + Math.floor(i / 3));
    const lines = text.split("\n");
    expect(lines[0]).toBe(
      "order: 4 kanji from theme words, 1 from other words (3 of them building blocks), 4 leftovers",
    );
    expect(text).toContain("# Level 2\n日  building block of 時 (時 1.00)");
    expect(text).toContain("時  時 1.00 theme");
    expect(text).toContain("# Level 3\n時  時 1.00 theme\n駅  駅 0.01");
    expect(text).toMatch(/leftover/);
  });
});
