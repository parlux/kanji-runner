import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { travelCoverage } from "../../src/core/coverage";
import { KANJI } from "../../src/core/kanji";
import { measure } from "../../scripts/coverage";
import { travelJson, TRAVEL_TEXTS } from "../../scripts/travel";

const lines = (name: string) =>
  readFileSync(`scripts/coverage/${name}.txt`, "utf8")
    .split("\n")
    .filter((l) => l.trim());

/** The mean of `measure`'s kanji coverage over the three texts. */
const meanMeasure = (known: Set<string>) =>
  TRAVEL_TEXTS.reduce((s, n) => s + measure(lines(n), known).coverage, 0) /
  TRAVEL_TEXTS.length;

describe("travelCoverage", () => {
  it("is 0 with no kanji and 1 with all of them", () => {
    expect(travelCoverage(() => false)).toBe(0);
    expect(travelCoverage(() => true)).toBeCloseTo(1, 12);
  });

  it("equals measure's mean on the same texts", () => {
    for (const n of [1, 50, 100, 300, 1000]) {
      const known = new Set(KANJI.slice(0, n).map((k) => k.char));
      expect(travelCoverage((c) => known.has(c))).toBeCloseTo(
        meanMeasure(known),
        12,
      );
    }
    const known = new Set(KANJI.slice(0, 100).map((k) => k.char));
    expect(travelCoverage((c) => known.has(c))).toBeGreaterThan(0);
  });

  it("travel.json is up to date with the texts", () => {
    expect(readFileSync("src/data/travel.json", "utf8")).toBe(travelJson());
  });
});
