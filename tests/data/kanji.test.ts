import { describe, expect, it } from "vitest";
import kanji from "../../src/data/kanji.json";

describe("kanji data", () => {
  it("holds the 2136 Jōyō kanji once each", () => {
    expect(kanji).toHaveLength(2136);
    expect(new Set(kanji.map((k) => k.char)).size).toBe(2136);
  });
});
