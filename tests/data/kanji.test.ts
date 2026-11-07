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
});
