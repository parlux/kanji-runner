import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KANJI, maxLevel } from "../../src/core/kanji";
import { WORDS } from "../../src/core/words";
import loanwords from "../../src/data/loanwords.json";
import words from "../../src/data/words.json";
import { LEVEL_ITEMS } from "../../scripts/levels";
import { fileLevel } from "../../scripts/stories/levels";

// SPEC-overall-progress §2: levels of 15 new things, on the shipped data.
const top = maxLevel(KANJI);
const levelOf = new Map(KANJI.map((k) => [k.char, k.level]));
const itemsAt = (l: number) =>
  KANJI.filter((k) => k.level === l).length +
  WORDS.filter((w) => w.level === l).length;

describe("levels of 15 new things (data)", () => {
  it("runs Kanji 1–296 (levels 2–297)", () => {
    expect(KANJI[0]?.level).toBe(2);
    expect(top).toBe(297);
    const levels = [...new Set(KANJI.map((k) => k.level))];
    expect(levels).toEqual(levels.map((_, i) => i + 2));
  });

  it("gives every level 15 items counting its loanword, the last at most 15", () => {
    for (let l = 2; l < top; l++) expect(itemsAt(l), `L${l}`).toBe(LEVEL_ITEMS);
    expect(itemsAt(top)).toBeGreaterThan(0);
    expect(itemsAt(top)).toBeLessThanOrEqual(LEVEL_ITEMS);
  });

  it("puts one loanword on each of levels 2–232", () => {
    const levels = WORDS.filter((w) => w.kind === "loanword").map(
      (w) => w.level,
    );
    expect(loanwords).toHaveLength(231);
    expect(levels).toEqual(loanwords.map((_, i) => 2 + i));
  });

  it("keeps the kanji order (snapshot before re-levelling)", () => {
    const order = readFileSync("tests/data/kanji-order.txt", "utf8").trim();
    expect(KANJI.map((k) => k.char).join("")).toBe(order);
  });

  it("never puts a word before its kanji", () => {
    for (const w of words)
      for (const c of w.word)
        expect(w.level, w.word).toBeGreaterThanOrEqual(levelOf.get(c) ?? 0);
  });

  it("keeps the word set (2067 words, hash before re-levelling)", () => {
    const set = words
      .map((w) => JSON.stringify([w.word, w.reading, w.glosses, w.kind]))
      .sort();
    expect(createHash("sha256").update(set.join("\n")).digest("hex")).toBe(
      "a7985434e5e4db679d00df76aeac4ce45d4bcc4f811075ec887bbe30977633ab",
    );
  });

  it("has one story file per level with exactly that level's kanji", () => {
    const dir = "dictionary/stories";
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files).toHaveLength(top - 1);
    for (const f of files) {
      const level = fileLevel(f);
      const data = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as {
        level: string;
        kanji: Record<string, unknown>;
      };
      expect(data.level, f).toBe(`Kanji ${(level ?? 0) - 1}`);
      expect(Object.keys(data.kanji), f).toEqual(
        KANJI.filter((k) => k.level === level).map((k) => k.char),
      );
    }
  });
});
