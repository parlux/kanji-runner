import { describe, expect, it } from "vitest";
import confusables from "../../src/data/confusables.json";
import kana from "../../src/data/kana.json";
import kanjiData from "../../src/data/kanji.json";
import type { KanjiItem } from "../../src/core/types";

const kanji = new Map((kanjiData as KanjiItem[]).map((k) => [k.char, k]));
const components = confusables.components as Record<string, string[]>;

describe("confusables data", () => {
  it("groups kana look-alikes from one script", () => {
    const script = new Map(kana.map((k) => [k.char, k.script]));
    for (const group of confusables.kana) {
      expect(group.length).toBeGreaterThan(1);
      const scripts = new Set(group.map((c) => script.get(c)));
      expect(scripts.size, group.join("")).toBe(1);
      expect(scripts.has(undefined), group.join("")).toBe(false);
    }
  });

  it("indexes each shared component by the kanji that contain it", () => {
    for (const [component, chars] of Object.entries(components)) {
      expect(chars.length).toBeGreaterThan(1);
      for (const c of chars)
        expect(kanji.get(c)?.components).toContain(component);
    }
    expect(components["⺅"]).toEqual(expect.arrayContaining(["休", "体"]));
  });
});
