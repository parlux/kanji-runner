import { describe, expect, it } from "vitest";
import data from "../../src/data/kanji.json";
import type { KanjiItem } from "../../src/core/types";

const kanji = data as KanjiItem[];
const KATAKANA = /[゠-ヿ]/;

describe("kanji data", () => {
  it("holds the 2136 Jōyō kanji once each", () => {
    expect(kanji).toHaveLength(2136);
    expect(new Set(kanji.map((k) => k.char)).size).toBe(2136);
  });

  it("gives every kanji a gloss and a main reading", () => {
    for (const k of kanji) {
      expect(k.glosses[0], k.char).toMatch(/\S/);
      expect(k.on !== null || k.kun !== null, k.char).toBe(true);
      expect(k.readings.length, k.char).toBeGreaterThan(0);
    }
  });

  it("writes every reading in hiragana, without dashes or dots", () => {
    for (const k of kanji) {
      const main = [k.on ?? "", k.kun?.base ?? "", k.kun?.okurigana ?? ""];
      for (const r of [...main, ...k.readings]) {
        expect(r, k.char).not.toMatch(KATAKANA);
        expect(r, k.char).not.toMatch(/[-.]/);
      }
    }
  });

  it("lists the main readings among all readings", () => {
    for (const k of kanji) {
      if (k.on) expect(k.readings, k.char).toContain(k.on);
      if (k.kun)
        expect(k.readings, k.char).toContain(k.kun.base + k.kun.okurigana);
    }
  });

  it("splits okurigana out of the main kun'yomi", () => {
    const see = kanji.find((k) => k.char === "見");
    expect(see?.kun).toEqual({ base: "み", okurigana: "る" });
    expect(kanji.find((k) => k.char === "一")?.on).toBe("いち");
  });

  it("fills every level with 30 kanji except the last", () => {
    const sizes = new Map<number, number>();
    for (const k of kanji) sizes.set(k.level, (sizes.get(k.level) ?? 0) + 1);
    const levels = [...sizes.keys()];
    expect(levels).toEqual(levels.map((_, i) => i + 2));
    const counts = [...sizes.values()];
    expect(counts.slice(0, -1).every((n) => n === 30)).toBe(true);
    expect(counts.at(-1)).toBeGreaterThan(0);
    expect(counts.at(-1)).toBeLessThanOrEqual(30);
  });

  it("puts every component that is a kanji before the kanji using it", () => {
    const index = new Map(kanji.map((k, i) => [k.char, i]));
    for (const [i, k] of kanji.entries()) {
      for (const c of k.components) {
        if (index.has(c))
          expect(index.get(c), `${c} in ${k.char}`).toBeLessThan(i);
      }
    }
  });

  it("starts with simple grade 1 kanji", () => {
    const first = kanji.slice(0, 30).map((k) => k.char);
    for (const c of "一二三人口山日大木") expect(first).toContain(c);
  });

  it("reads KRADFILE's stand-in elements as radicals", () => {
    const rest = kanji.find((k) => k.char === "休");
    expect(rest?.components).toEqual(["\u2e85", "木"]);
  });
});
